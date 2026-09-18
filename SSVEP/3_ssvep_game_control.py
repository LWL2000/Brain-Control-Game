from __future__ import absolute_import, division
import multiprocessing
import time
import pandas as pd
from psychopy import gui, visual, core, data, logging
from psychopy.constants import (NOT_STARTED, STARTED, FINISHED)
from numpy import (sin, pi, )
import os
from psychopy.hardware import keyboard
import model
import numpy as np
import serial
from data_anlysis.data_to_float import notch_filter, butter_bandpass_filter
from lsl_received_data import lsl_received

# 添加WebSocket相关的导入
import asyncio
import websockets
import sys
import threading
from eyetrax_ssvep_adapter import EyeTraxSSVEPAdapter, parse_bool

# 保存连接的客户端
connected_clients = set()

# WebSocket服务器状态
ws_server_running = False
ws_server = None

async def handle_client(websocket):
    """处理客户端连接"""
    # 添加客户端到连接集合
    connected_clients.add(websocket)
    print(f"新的客户端已连接，当前连接数: {len(connected_clients)}")
    
    try:
        # 接收并处理消息
        async for message in websocket:
            print(f"收到来自客户端的消息: {message}")
            # 这里可以根据需要处理客户端消息
            
    except websockets.exceptions.ConnectionClosed as e:
        print(f"客户端连接已关闭: {e}")
    finally:
        # 从连接集合中移除客户端
        connected_clients.remove(websocket)
        print(f"客户端已断开连接，当前连接数: {len(connected_clients)}")

async def send_command_to_clients(command):
    """发送命令到所有连接的客户端"""
    if not connected_clients:
        print("没有连接的客户端，无法发送命令")
        return False
    
    # 向所有连接的客户端发送命令
    disconnected_clients = []
    for client in connected_clients:
        try:
            await client.send(command)
            print(f"命令 '{command}' 已发送到客户端")
        except Exception as e:
            print(f"发送命令到客户端时出错: {e}")
            disconnected_clients.append(client)
    
    # 移除断开连接的客户端
    for client in disconnected_clients:
        connected_clients.discard(client)
    
    return True

async def control_game_server():
    """游戏控制主函数，包含WebSocket服务器"""
    global ws_server
    # 启动WebSocket服务器
    print("正在启动WebSocket服务器...")
    ws_server = await websockets.serve(handle_client, "localhost", 8767)
    print("WebSocket服务器已启动，监听端口 8767")
    print("请在浏览器中打开 breakout_game.html 文件")
    
    # 保持服务器运行
    async with ws_server:
        await asyncio.Future()  # 永远运行

def start_websocket_server():
    """在单独线程中启动WebSocket服务器"""
    global ws_server_running
    ws_server_running = True
    asyncio.run(control_game_server())

def send_game_command(command):
    """发送游戏控制命令的同步接口"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(send_command_to_clients(command))
    loop.close()
    return result

def decorator(func):
    def wrapper(*args, **kwargs):
        try:
            res = func(*args, **kwargs)
            return res
        except Exception as e:
            print("执行函数：{}，出现异常：{}".format(func.__name__, e))
    return wrapper

def main():
    multiprocessing.freeze_support()  #防止重复启动

    # 启动WebSocket服务器线程
    ws_thread = threading.Thread(target=start_websocket_server, daemon=True)
    ws_thread.start()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    save_path = os.path.join(script_dir, "eeg_data")
    default_eyetrax_model = os.path.join(script_dir, "eyetrax_models", "gaze_model.pkl")
    os.makedirs(save_path, exist_ok=True)
    queue = multiprocessing.Queue()
    process = multiprocessing.Process(target=lsl_received,args=(queue, save_path))
    process.start()
    trial_dura = 5
    Ename= '脑控游戏'
    EInfo = {
        '参与者姓名': '',
        '性别': '男',
        '年龄': "22",
        '端口号': 'COM',
        '启用': False,
        '结果': False,
        '验证': False,
        'Brain': "0",
        '校准': "5p",
        '模型': default_eyetrax_model,
    }

    dig= gui.DlgFromDict(dictionary=EInfo, sortKeys=False, title=Ename)
    if dig.OK == False:
        core.quit()
    EInfo['date'] = data.getDateStr()
    EInfo['expName'] = Ename
    filename =  (EInfo['参与者姓名'], Ename,EInfo['性别'],Ename,EInfo['年龄'])

    print(filename)
    eye_validation_visible = parse_bool(EInfo.get('验证', False))
    eye_enabled = parse_bool(EInfo.get('启用', False)) or eye_validation_visible
    eye_tracker = EyeTraxSSVEPAdapter(
        enabled=eye_enabled,
        override_result=parse_bool(EInfo.get('结果', False)),
        camera_index=int(EInfo.get('Brain', 0) or 0),
        calibration=EInfo.get('校准', '5p'),
        model_file=EInfo.get('模型', default_eyetrax_model),
    )
    if eye_tracker.enabled:
        print("Starting EyeTrax real gaze tracking...")
        if not eye_tracker.start():
            err_dlg = gui.Dlg(title='EyeTrax启动失败')
            err_dlg.addText('EyeTrax未能启动，将退回纯SSVEP。')
            err_dlg.addText(str(eye_tracker.error))
            err_dlg.show()
        else:
            print(eye_tracker.status)
    endExpNow = False
    frameTolerance = 0.001
    win = visual.Window(
        size=[1920, 250], fullscr=False, screen=1,
        winType='pyglet', allowGUI=True, allowStencil=False,
        monitor='testMonitor', color=[-1.000, -1.000, -1.000], colorSpace='rgb',
        blendMode='avg', useFBO=True,
        units='height')

    EInfo['frameRate'] = win.getActualFrameRate()
    if EInfo['frameRate'] != None:
        pre_frame_durate = 1.0 / round(EInfo['frameRate'])
        print("frameRate", round(EInfo['frameRate']))
    else:
        pre_frame_durate = 1.0 / 60.0
    defaultKeyboard = keyboard.Keyboard()
    Clock = core.Clock()
    text = visual.TextStim(win=win, name='text',
                           text='脑控游戏\n\n按"空格"开始脑机控制\n\n可随时按"ESC"退出',
                           font='Arial',
                           units='pix', pos=(0, 0), height=50, wrapWidth=None, ori=0,
                           color='white', colorSpace='rgb', opacity=1,
                           languageStyle='LTR',
                           depth=0.0)
    keys = keyboard.Keyboard()
    # 3个频率和相位
    Freq = np.array([8.00, 9.00, 10.00])
    Phas = np.array([0, 0.15, 0.3])
    
    # 3个水平居中排列的位置
    center_y = 0  # 垂直居中
    spacing = 600  # 调整模块间距，使3个闪烁块均匀分布
    center_x = 0  # 水平居中
    
    # 创建3个水平排列的位置，对应左、动作、右
    location = [
        [center_x - spacing, center_y],  # 第一个模块 - 左
        [center_x, center_y],  # 第二个模块 - 动作
        [center_x + spacing, center_y],  # 第三个模块 - 右
    ]
    
    # 调整模块大小以适应水平排列
    size_w = 250  # 闪烁块长度
    size_h = 250  # 闪烁块高度，与长度相同尺寸
    
    # 3个指令
    order_lst = ['左', '动作', '右']
    eye_targets = [
        {'result': 1, 'label': order_lst[0], 'pos': location[0], 'size': (size_w, size_h)},
        {'result': 2, 'label': order_lst[1], 'pos': location[1], 'size': (size_w, size_h)},
        {'result': 3, 'label': order_lst[2], 'pos': location[2], 'size': (size_w, size_h)},
    ]
    
    # 创建4个闪烁模块和对应的文本标签（trial状态）
    polygon_trial_0 = visual.Rect(
        win=win, name='polygon_trial_0', units='pix',
        width=[1.0, 1.0][0], height=[1.0, 1.0][1],
        ori=0, pos=[0, 0],
        lineWidth=1, lineColor=[1, 1, 1], lineColorSpace='rgb',
        fillColor=1.0, fillColorSpace='rgb',
        opacity=1, depth=0.0, interpolate=True)
    order_trial_0 = visual.TextStim(win=win, name='text',
                                    text='左',
                                    font='Arial',
                                    units='pix', pos=(0, 0), height=50, wrapWidth=None, ori=0,
                                    color='white', colorSpace='rgb', opacity=1,
                                    languageStyle='LTR',
                                    depth=0.0)

    polygon_trial_1 = visual.Rect(
        win=win, name='polygon_trial_1', units='pix',
        width=[1.0, 1.0][0], height=[1.0, 1.0][1],
        ori=0, pos=[0, 0],
        lineWidth=1, lineColor=[1, 1, 1], lineColorSpace='rgb',
        fillColor=1.0, fillColorSpace='rgb',
        opacity=1, depth=-1.0, interpolate=True)
    order_trial_1 = visual.TextStim(win=win, name='text',
                                    text='动作',
                                    font='Arial',
                                    units='pix', pos=(0, 0), height=50, wrapWidth=None, ori=0,
                                    color='white', colorSpace='rgb', opacity=1,
                                    languageStyle='LTR',
                                    depth=-1.0)

    polygon_trial_3 = visual.Rect(
        win=win, name='polygon_trial_3', units='pix',
        width=[1.0, 1.0][0], height=[1.0, 1.0][1],
        ori=0, pos=[0, 0],
        lineWidth=1, lineColor=[1, 1, 1], lineColorSpace='rgb',
        fillColor=1.0, fillColorSpace='rgb',
        opacity=1, depth=-3.0, interpolate=True)
    order_trial_3 = visual.TextStim(win=win, name='text',
                                    text='右',
                                    font='Arial',
                                    units='pix', pos=(0, 0), height=50, wrapWidth=None, ori=0,
                                    color='white', colorSpace='rgb', opacity=1,
                                    languageStyle='LTR',
                                    depth=-3.0)

    eye_marker = visual.Circle(
        win=win, name='eyetrax_marker', units='pix',
        radius=12, pos=(0, 0),
        lineColor='red', fillColor='red',
        opacity=0.9, depth=-10.0)
    eye_status_text = visual.TextStim(
        win=win, name='eyetrax_status',
        text='EyeTrax验证: 未启用',
        font='Arial',
        units='pix', pos=(0, -115), height=24, wrapWidth=None, ori=0,
        color='yellow', colorSpace='rgb', opacity=1,
        languageStyle='LTR',
        depth=-11.0)
    eye_highlights = []
    for idx in range(3):
        eye_highlights.append(visual.Rect(
            win=win, name='eyetrax_roi_{}'.format(idx), units='pix',
            width=size_w + 30, height=size_h + 30,
            ori=0, pos=location[idx],
            lineWidth=5, lineColor='yellow', lineColorSpace='rgb',
            fillColor=None, fillColorSpace='rgb',
            opacity=1, depth=-12.0, interpolate=True))

    # 初始化时钟和计时器
    globalClock = core.Clock()
    routineTimer = core.CountdownTimer()
    
    # 准备初始指令界面组件
    keys.keys = []
    keys.rt = []
    instrComponents = [text, keys]
    for thisComponent in instrComponents:
        thisComponent.tStart = None
        thisComponent.tStop = None
        thisComponent.tStartRefresh = None
        thisComponent.tStopRefresh = None
        if hasattr(thisComponent, 'status'):
            thisComponent.status = NOT_STARTED
    
    # 初始指令界面循环
    t = 0
    _timeToFirstFrame = win.getFutureFlipTime(clock="now")
    Clock.reset(-_timeToFirstFrame)
    frameN = -1
    continueRoutine = True
    
    while continueRoutine:
        t = Clock.getTime()
        tThisFlip = win.getFutureFlipTime(clock=Clock)
        tThisFlipGlobal = win.getFutureFlipTime(clock=None)
        frameN = frameN + 1
        
        # 更新文本显示
        if text.status == NOT_STARTED and tThisFlip >= 0.0 - frameTolerance:
            text.frameNStart = frameN
            text.tStart = t
            text.tStartRefresh = tThisFlipGlobal
            win.timeOnFlip(text, 'tStartRefresh')
            text.setAutoDraw(True)
        
        # 键盘响应处理
        waitOnFlip = False
        if keys.status == NOT_STARTED and tThisFlip >= 0.0 - frameTolerance:
            keys.famreNStart = frameN
            keys.tStart = t
            keys.tStartRefresh = tThisFlipGlobal
            win.timeOnFlip(keys, 'tStartRefresh')
            keys.status = STARTED
            win.callOnFlip(keys.clearEvents, eventType='keyboard')
        
        if keys.status == STARTED and not waitOnFlip:
            theseKeys = keys.getKeys(keyList=['space'], waitRelease=False)
            if len(theseKeys):
                theseKeys = theseKeys[0]
                if "escape" == theseKeys:
                    endExpNow = True
                continueRoutine = False
        
        # 检查退出条件
        if endExpNow or defaultKeyboard.getKeys(keyList=["escape"]):
            core.quit()
        
        if not continueRoutine:
            break
        
        continueRoutine = False
        for thisComponent in instrComponents:
            if hasattr(thisComponent, "status") and thisComponent.status != FINISHED:
                continueRoutine = True
                break
        
        if continueRoutine:
            win.flip()
    
    # 清理初始界面组件
    for thisComponent in instrComponents:
        if hasattr(thisComponent, "setAutoDraw"):
            thisComponent.setAutoDraw(False)
    routineTimer.reset()
    
    # 准备试验循环
    trials = data.TrialHandler(nReps=100, method='random',
                               extraInfo=EInfo, originPath=-1,
                               trialList=[None],
                               seed=None, name='trials')
    
    thisTrial = trials.trialList[0]
    if thisTrial != None:
        for paramName in thisTrial:
            exec('{} = thisTrial[paramName]'.format(paramName))
    
    result = 0  # 初始识别结果
    
    # 主试验循环
    for thisTrial in trials:
        # 创建识别结果显示文本
        if result > 0 and result <= len(order_lst):
            restim = visual.TextStim(win, "识别控制指令：" + order_lst[result - 1], font='Arial',
                                     units='pix', pos=(0, 0), height=50, wrapWidth=None, ori=0,
                                     color='red', colorSpace='rgb', opacity=1,
                                     languageStyle='LTR',
                                     depth=0.0)
        
        currentLoop = trials
        if thisTrial != None:
            for paramName in thisTrial:
                exec('{} = thisTrial[paramName]'.format(paramName))
        
        routineTimer.add(1.000000)
        
        # 更新trial状态的3个闪烁模块位置
        polygon_trial_0.setPos((location[0][0], location[0][1]))
        order_trial_0.setPos((location[0][0], location[0][1]))
        polygon_trial_0.setSize((size_w, size_h))
        
        # polygon_trial_1 使用中间位置 - 动作
        polygon_trial_1.setPos((location[1][0], location[1][1]))
        order_trial_1.setPos((location[1][0], location[1][1]))
        polygon_trial_1.setSize((size_w, size_h))
        
        # polygon_trial_3 使用右侧位置 - 右
        polygon_trial_3.setPos((location[2][0], location[2][1]))
        order_trial_3.setPos((location[2][0], location[2][1]))
        polygon_trial_3.setSize((size_w, size_h))
        
        # 选择列表，只包含3个激活的闪烁模块
        seleclist2 = [polygon_trial_0, polygon_trial_1, polygon_trial_3]
        
        # 试验组件列表
        trialComponents = [polygon_trial_0, polygon_trial_1, polygon_trial_3]
        
        # 初始化组件状态
        for thisComponent in trialComponents:
            thisComponent.tStart = None
            thisComponent.tStop = None
            thisComponent.tStartRefresh = None
            thisComponent.tStopRefresh = None
            if hasattr(thisComponent, 'status'):
                thisComponent.status = NOT_STARTED
        
        # 试验循环
        t = 0
        _timeToFirstFrame = win.getFutureFlipTime(clock="now")
        trialClock = core.Clock()
        trialClock.reset(-_timeToFirstFrame)
        frameN = -1
        continueRoutine = True
        
        # 开始采集数据
        queue.put("start-1")
        begin_time = time.time()
        eye_result_samples = []
        
        while continueRoutine:
            t = trialClock.getTime()
            tThisFlip = win.getFutureFlipTime(clock=trialClock)
            tThisFlipGlobal = win.getFutureFlipTime(clock=None)
            frameN = frameN + 1
            
            # 隐藏结果提示
            # if result > 0:
            #     restim.setAutoDraw(False)
            
            # 处理polygon_trial_0（左）
            if polygon_trial_0.status == NOT_STARTED and tThisFlip >= 0.0 - frameTolerance:
                polygon_trial_0.frameNStart = frameN
                polygon_trial_0.tStart = t
                polygon_trial_0.tStartRefresh = tThisFlipGlobal
                win.timeOnFlip(polygon_trial_0, 'tStartRefresh')
                polygon_trial_0.setAutoDraw(True)
                order_trial_0.setAutoDraw(True)
            if polygon_trial_0.status == STARTED:
                if tThisFlipGlobal > polygon_trial_0.tStartRefresh + trial_dura - frameTolerance:
                    polygon_trial_0.tStop = t
                    polygon_trial_0.frameNStop = frameN
                    win.timeOnFlip(polygon_trial_0, 'tStopRefresh')
                    polygon_trial_0.setAutoDraw(False)
                    order_trial_0.setAutoDraw(False)
            if polygon_trial_0.status == STARTED:
                polygon_trial_0.setFillColor([1, 1, 1], log=False)
            
            # 处理polygon_trial_1（动作）
            if polygon_trial_1.status == NOT_STARTED and tThisFlip >= 0.0 - frameTolerance:
                polygon_trial_1.frameNStart = frameN
                polygon_trial_1.tStart = t
                polygon_trial_1.tStartRefresh = tThisFlipGlobal
                win.timeOnFlip(polygon_trial_1, 'tStartRefresh')
                polygon_trial_1.setAutoDraw(True)
                order_trial_1.setAutoDraw(True)
            if polygon_trial_1.status == STARTED:
                if tThisFlipGlobal > polygon_trial_1.tStartRefresh + trial_dura - frameTolerance:
                    polygon_trial_1.tStop = t
                    polygon_trial_1.frameNStop = frameN
                    win.timeOnFlip(polygon_trial_1, 'tStopRefresh')
                    polygon_trial_1.setAutoDraw(False)
                    order_trial_1.setAutoDraw(False)
            if polygon_trial_1.status == STARTED:
                polygon_trial_1.setFillColor([1, 1, 1], log=False)
            
            # 处理polygon_trial_3（右）
            if polygon_trial_3.status == NOT_STARTED and tThisFlip >= 0.0 - frameTolerance:
                polygon_trial_3.frameNStart = frameN
                polygon_trial_3.tStart = t
                polygon_trial_3.tStartRefresh = tThisFlipGlobal
                win.timeOnFlip(polygon_trial_3, 'tStartRefresh')
                polygon_trial_3.setAutoDraw(True)
                order_trial_3.setAutoDraw(True)
            if polygon_trial_3.status == STARTED:
                if tThisFlipGlobal > polygon_trial_3.tStartRefresh + trial_dura - frameTolerance:
                    polygon_trial_3.tStop = t
                    polygon_trial_3.frameNStop = frameN
                    win.timeOnFlip(polygon_trial_3, 'tStopRefresh')
                    polygon_trial_3.setAutoDraw(False)
                    order_trial_3.setAutoDraw(False)
            if polygon_trial_3.status == STARTED:
                polygon_trial_3.setFillColor([1, 1, 1], log=False)
            
            # 更新3个闪烁块的亮度，实现闪烁效果
            Amp = (sin(2 * pi * Freq * frameN / 60 + Phas) - 0.5) * 2.0
            for idx in range(3):
                seleclist2[idx].setFillColor([Amp[idx]])

            if eye_validation_visible:
                for highlight in eye_highlights:
                    highlight.setAutoDraw(False)
                eye_marker.setAutoDraw(False)
                eye_status_text.setAutoDraw(False)

            if eye_tracker.enabled and eye_tracker.active:
                eye_state = eye_tracker.get_state(win.size, eye_targets)
                if eye_state is not None:
                    eye_result = int(eye_state.get('target_result', 0) or 0)
                    eye_result_samples.append(eye_result)
                    if eye_validation_visible:
                        eye_status_text.setText("EyeTrax验证: {}".format(eye_state.get('target_label', '未命中')))
                        eye_status_text.setAutoDraw(True)
                        if eye_state.get('valid') and eye_state.get('win_pos') is not None:
                            eye_marker.setPos(eye_state['win_pos'])
                            eye_marker.setAutoDraw(True)
                        if eye_result > 0 and eye_result <= len(eye_highlights):
                            eye_highlights[eye_result - 1].setAutoDraw(True)
                elif eye_validation_visible:
                    eye_status_text.setText("EyeTrax验证: 无数据")
                    eye_status_text.setAutoDraw(True)
            elif eye_validation_visible:
                eye_status_text.setText("EyeTrax验证: 未启动")
                eye_status_text.setAutoDraw(True)
            
            # 检查退出条件
            if endExpNow or defaultKeyboard.getKeys(keyList=["escape"]):
                core.quit()
            
            if not continueRoutine:
                break
            
            continueRoutine = False
            for thisComponent in trialComponents:
                if hasattr(thisComponent, "status") and thisComponent.status != FINISHED:
                    continueRoutine = True
                    break
            
            if continueRoutine:
                win.flip()
        
        # 结束数据采集
        queue.put("ending")
        time.sleep(1)
        
        # 数据处理和分类
        temp_file = os.path.join(save_path, "temp.csv")
        if not os.path.exists(temp_file):
            print(f"EEG data file was not generated: {temp_file}")
            print("Start the BLE collector first and make sure it publishes an LSL stream with type='EEG'.")
            continue
        np_array = pd.read_csv(temp_file).to_numpy()
        np_array = np_array[:, 1:]  # 移除第一列索引
        data_len = np_array.shape[0]
        np_array = np_array.transpose(1, 0)
        print(np_array)
        
        # 应用滤波
        np_array = notch_filter(np_array, fs=250, freq=50, Q=30)  # 陷波滤波
        np_array = butter_bandpass_filter(np_array, lowcut=6, highcut=70, fs=250, order=5)  # 带通滤波
        
        # 截取有效数据段
        np_array = np_array[:, int(0.5*250):int(4.5*250)]
        
        print("识别数据形状:{}".format(np_array.shape))
        
        # 使用FBCCA模型进行分类
        result = model.fbcca_classify(np_array)
        # print("result:", result, order_lst[result - 1])
        ssvep_result = result
        result, eye_override_result = eye_tracker.choose_result(result, eye_result_samples)
        if eye_tracker.enabled:
            print("SSVEP result: {}, EyeTrax override result: {}, final result: {}".format(
                ssvep_result, eye_override_result, result))
        
        # 固定映射：1=左，2=动作，3=右。所有网页游戏都按这个协议接收。
        command_map = {
            1: ('1', '左'),
            2: ('2', '动作'),
            3: ('3', '右'),
        }
        if result in command_map:
            command, command_label = command_map[result]
            print("发送游戏指令: {} ({})".format(command, command_label))
            send_game_command(command)
        # 其他结果视为无效，不发送命令
        
        # 清理试验组件
        for thisComponent in trialComponents:
            if hasattr(thisComponent, "setAutoDraw"):
                thisComponent.setAutoDraw(False)
        eye_marker.setAutoDraw(False)
        eye_status_text.setAutoDraw(False)
        for highlight in eye_highlights:
            highlight.setAutoDraw(False)
        routineTimer.reset()
    
    # 结束实验
    win.flip()
    logging.flush()
    eye_tracker.stop()
    win.close()
    core.quit()

if __name__ == '__main__':
    main()
