from scipy.signal import iirnotch, filtfilt, butter
import numpy as np
def parse_egg(hex_body):
    parse_data = []
    for index in range(0,120 - 1,24):
        data = hex_body[index:index + 24]
        decimal_array = hex_to_dec(data)
        parse_data.append(decimal_array)
    return np.array(parse_data)
def parse_trigger_hex_data(hex_body):##trigger
    parse_data=[]
    for index in range(0,10,2):
        num = hex_body[index:index+2]
        parse_data.append(int(num))
    return np.array(parse_data).reshape([5,-1])
def hex_to_dec(bytes_data):#将每三个字节解析成一个整数
    # bytes_data = bytes.fromhex(conver_to_str(data))
    data =[]
    for i in range(8):
        value = int.from_bytes(bytes_data[i * 3:i * 3 + 3],byteorder="big", signed=True) * 0.02235
        data .append(value)
    return data
def butter_bandpass(lowcut, highcut, fs, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def butter_bandpass_filter(data, lowcut, highcut, fs, order=5):
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    y = filtfilt(b, a, data)
    return y

def notch_filter(data, fs, freq=50, Q=30):
    b, a = iirnotch(freq, Q, fs)
    filtered_data = filtfilt(b, a, data)
    return filtered_data