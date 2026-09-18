from __future__ import annotations

import atexit
import os
import sys
import threading
import time
from collections import Counter
from pathlib import Path

import numpy as np


DEFAULT_EYETRAX_REPO = Path(__file__).resolve().parents[1] / "external" / "eyetrax"


def parse_bool(value):
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    return text in {"1", "true", "yes", "y", "on", "是", "启用", "使用"}


def add_eyetrax_paths(repo_path=None):
    repo = Path(repo_path or os.environ.get("EYETRAX_REPO", DEFAULT_EYETRAX_REPO))
    src = repo / "src"
    site_packages = repo / ".venv" / "Lib" / "site-packages"
    for path in (str(src), str(site_packages)):
        if os.path.isdir(path) and path not in sys.path:
            sys.path.insert(0, path)
    return repo


class EyeTraxSSVEPAdapter:
    """Read real EyeTrax gaze points and map them to PsychoPy SSVEP target ROIs."""

    def __init__(
        self,
        enabled=False,
        camera_index=0,
        calibration="5p",
        model_file="",
        model_name="ridge",
        repo_path=None,
        override_result=False,
        min_samples=8,
    ):
        self.enabled = bool(enabled)
        self.camera_index = int(camera_index or 0)
        self.calibration = str(calibration or "5p").strip().lower()
        self.model_file = str(model_file or "").strip()
        self.model_name = str(model_name or "ridge").strip()
        self.repo_path = repo_path
        self.override_result = bool(override_result)
        self.min_samples = int(min_samples or 8)

        self.active = False
        self.error = ""
        self.status = "EyeTrax disabled"
        self.screen_size = (1920, 1080)
        self._lock = threading.Lock()
        self._latest = None
        self._stop_event = threading.Event()
        self._thread = None
        self._cap = None
        self._estimator = None

    def start(self):
        if not self.enabled:
            return False
        try:
            add_eyetrax_paths(self.repo_path)
            import cv2  # noqa: F401
            from eyetrax import GazeEstimator
            from eyetrax.calibration import (
                run_5_point_calibration,
                run_9_point_calibration,
                run_dense_grid_calibration,
                run_lissajous_calibration,
            )
            from eyetrax.utils.screen import get_screen_size
            from eyetrax.utils.video import open_camera

            self.screen_size = tuple(get_screen_size())
            self._estimator = GazeEstimator(model_name=self.model_name)

            model_path = Path(self.model_file) if self.model_file else None
            if model_path and model_path.exists():
                self._estimator.load_model(str(model_path))
                self.status = "EyeTrax model loaded"
            else:
                if self.calibration == "9p":
                    run_9_point_calibration(self._estimator, camera_index=self.camera_index)
                elif self.calibration == "dense":
                    run_dense_grid_calibration(self._estimator, camera_index=self.camera_index)
                elif self.calibration == "lissajous":
                    run_lissajous_calibration(self._estimator, camera_index=self.camera_index)
                else:
                    run_5_point_calibration(self._estimator, camera_index=self.camera_index)
                self.status = "EyeTrax calibrated"
                if model_path:
                    model_path.parent.mkdir(parents=True, exist_ok=True)
                    self._estimator.save_model(str(model_path))

            self._cap = open_camera(self.camera_index)
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._reader_loop, daemon=True)
            self._thread.start()
            self.active = True
            atexit.register(self.stop)
            return True
        except Exception as exc:
            self.error = str(exc)
            self.status = "EyeTrax error: {}".format(exc)
            self.active = False
            self.stop()
            return False

    def stop(self):
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        self._thread = None
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
        if self._estimator is not None:
            try:
                self._estimator.close()
            except Exception:
                pass
            self._estimator = None

    def _reader_loop(self):
        while not self._stop_event.is_set():
            try:
                ok, frame = self._cap.read()
                if not ok:
                    time.sleep(0.02)
                    continue
                features, blink = self._estimator.extract_features(frame)
                now = time.time()
                if features is not None and not blink:
                    x, y = self._estimator.predict(np.array([features]))[0]
                    latest = {
                        "x": float(x),
                        "y": float(y),
                        "blink": False,
                        "time": now,
                    }
                else:
                    latest = {
                        "x": None,
                        "y": None,
                        "blink": bool(blink),
                        "time": now,
                    }
                with self._lock:
                    self._latest = latest
            except Exception as exc:
                self.error = str(exc)
                time.sleep(0.05)

    def _screen_to_window(self, x, y, win_size):
        screen_w, screen_h = self.screen_size
        win_w, win_h = float(win_size[0]), float(win_size[1])
        sx = max(float(screen_w), 1.0)
        sy = max(float(screen_h), 1.0)
        win_x = (float(x) / sx) * win_w - win_w / 2.0
        win_y = win_h / 2.0 - (float(y) / sy) * win_h
        return win_x, win_y

    def get_state(self, win_size, targets, max_age=0.7):
        if not self.enabled or not self.active:
            return None
        with self._lock:
            latest = dict(self._latest) if self._latest else None
        if not latest:
            return None
        age = time.time() - latest.get("time", 0)
        if age > max_age or latest.get("x") is None or latest.get("y") is None:
            return {
                "valid": False,
                "blink": latest.get("blink", False),
                "age": age,
                "target_result": 0,
                "target_label": "未命中",
                "status": "EyeTrax: no gaze",
            }

        win_x, win_y = self._screen_to_window(latest["x"], latest["y"], win_size)
        target_result = 0
        target_label = "未命中"
        for target in targets:
            tx, ty = target["pos"]
            tw, th = target["size"]
            if abs(win_x - tx) <= tw / 2.0 and abs(win_y - ty) <= th / 2.0:
                target_result = int(target["result"])
                target_label = str(target["label"])
                break

        return {
            "valid": True,
            "blink": False,
            "age": age,
            "screen_pos": (latest["x"], latest["y"]),
            "win_pos": (win_x, win_y),
            "target_result": target_result,
            "target_label": target_label,
            "status": "EyeTrax: {}".format(target_label),
        }

    def choose_result(self, ssvep_result, samples):
        if not self.enabled or not self.override_result:
            return ssvep_result, 0
        valid_samples = [int(x) for x in samples if int(x) > 0]
        if len(valid_samples) < self.min_samples:
            return ssvep_result, 0
        eye_result, count = Counter(valid_samples).most_common(1)[0]
        if count < self.min_samples:
            return ssvep_result, 0
        return eye_result, eye_result
