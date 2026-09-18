import os
import time
import numpy as np
import pandas as pd
from pylsl import StreamInlet, resolve_byprop


def _resolve_eeg_stream():
    while True:
        streams = resolve_byprop("type", "EEG", minimum=1, timeout=1.0)
        if streams:
            return streams[0]
        print("Waiting for EEG LSL stream. Start the BLE collector first.")


def lsl_received(queue,path):
    os.makedirs(path, exist_ok=True)
    stream_info = _resolve_eeg_stream()
    inlet = StreamInlet(stream_info)
    while True:
        eeg_data = []
        content = queue.get()
        if content.startswith("st"):
            flag=0
            while True:
                sample, timestamp = inlet.pull_sample()
                eeg_data.append(sample)
                if not queue.empty():
                    content= queue.get()
                    if content.startswith("end"):
                        break
            eeg_data = np.array(eeg_data)
            pd.DataFrame(eeg_data).to_csv(os.path.join(path, "{}.csv".format("temp")))
        elif content == "del":
            print("quit")
            break

