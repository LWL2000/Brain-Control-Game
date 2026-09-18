# SSVEP 接入说明

## 当前接入方式

这些小游戏会在页面加载后自动连接 WebSocket：

```text
ws://localhost:8767
```

`3_ssvep_game_control.py` 向浏览器发送字符串指令：

```text
1
2
3
```

网页游戏不直接接 EyeTrax。是否启用眼动、是否用眼动覆盖 SSVEP 结果，都在 Python 侧完成。

## 推荐启动顺序

1. 启动 BLE 采集程序，保证 LSL 数据正常。
2. 启动 `3_ssvep_game_control.py`。
3. 在 PsychoPy 参数对话框中选择：
   - `启用EyeTrax眼控`
   - `EyeTrax覆盖SSVEP结果`
   - `EyeTrax验证显示`
   - `EyeTrax摄像头`
   - `EyeTrax校准方式`
   - `EyeTrax模型文件`
4. 打开 `ssvep_mini_games/index.html`。
5. 进入一个小游戏并点击该游戏自己的 SSVEP 开始按钮。
6. 确认页面右下角显示 `WebSocket 已连接`。

## EyeTrax 使用方式

勾选 `启用EyeTrax眼控` 后，EyeTrax 会在后台读取真实眼动并判断当前注视的 SSVEP 目标。默认为了演示时界面干净，PsychoPy 闪烁目标界面不会显示红点、黄色高亮框或 EyeTrax 状态文字。

勾选 `EyeTrax验证显示` 后，会在 SSVEP 刺激界面显示：

- 红点：EyeTrax 当前 gaze 位置
- 黄色高亮框：EyeTrax 判断命中的 SSVEP 目标
- `EyeTrax验证: 左/动作/右/未命中` 状态文字

这个选项会自动启用 EyeTrax，适合排查“我看的是动作，为什么实际执行成右”这类问题。

如果只想后台采集眼动但不影响游戏指令，可以只勾选 `启用EyeTrax眼控`，不要勾选 `EyeTrax覆盖SSVEP结果`。

如果希望 EyeTrax 结果替代 SSVEP 分类结果，再勾选 `EyeTrax覆盖SSVEP结果`。

排查顺序：

1. 如果红点/黄框就落在错误目标，优先检查 EyeTrax 校准或摄像头。
2. 如果红点/黄框正确，但控制台 `final result` 错，检查是否启用了覆盖以及 SSVEP 分类结果。
3. 如果 `final result` 和 `发送游戏指令` 正确，但网页动作错，检查当前网页是否刷新到了最新文件。

## 命令映射

命令映射已经固定，避免页面选项和 Python 目标顺序不一致：

| 指令 | SSVEP 显示 | 网页动作 |
|---|---|---|
| `1` | 左 | `left` |
| `2` | 动作 | `action` |
| `3` | 右 | `right` |

当前 `3_ssvep_game_control.py` 的目标顺序是：

```python
order_lst = ['左', '动作', '右']
```
