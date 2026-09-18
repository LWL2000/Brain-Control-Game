import numpy as np
def complement_24bit_to_true_value(complement_decimal):
    if complement_decimal >= 0:
        return complement_decimal
    else:
        sina ='1'
        # 先计算 24 位补码的二进制表示
        binary_str = format(abs(complement_decimal), '023b')
        inverse_str = ''.join(['1' if bit == '0' else '0' for bit in binary_str[0:]])
        original_str = format(int(inverse_str, 2)+1, '023b')#取反+1得到原码
        # 判断符号位并计算真值
        value = int(original_str, 2)
        if sina == '1':
            value=-1*value
        else:
            value=value
        return  value
def parse_egg(hex_body):
    parse_data = []
    for index in range(0,120 - 1,24):#遍历120字节次取24个字节
        data = hex_body[index:index + 24]#24个字节
        decimal_array = hex_to_dec(data)#字节数组转整数
        parse_data.append(decimal_array)#（5，8）
    return np.array(parse_data)
def parse_trigger_hex_data(hex_body):##trigger处理的还没用到
    parse_data=[]
    for index in range(0,10,2):
        num = hex_body[index:index+2]
        parse_data.append(int(num))
    return np.array(parse_data).reshape([5,-1])
def hex_to_dec(bytes_data):#将每三个字节解析成一个整数
    # bytes_data = bytes.fromhex(conver_to_str(data))
    data =[]
    for i in range(8):
        value = (int.from_bytes(bytes_data[i * 3:(i+1) * 3 ],byteorder="big", signed=True))* 0.02235
       # value=complement_24bit_to_true_value(value)* 0.02235#转真值
        data .append(value)
    return data