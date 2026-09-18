import asyncio
import binascii
import os
import sys
import time
from pathlib import Path
from pylsl import StreamInfo
from bleak import BleakClient, BleakScanner
from loguru import logger
from pylsl import StreamOutlet

from data_anlysis.data_to_float import parse_egg

service_uuid = ""#"f0001130-0451-4000-b000-000000000000"
ble_config_uuid = ""#"f0001131-0451-4000-b000-000000000000"  # 配置数据
eeg_notify_uuid = ""#"f0001132-0451-4000-b000-000000000000"  # 脑电数据
protocol_bucket = None


def setup_logging():
    logger.remove()
    logger.add(sys.stderr, level="INFO", enqueue=True)
    portable_home = os.environ.get("SSVEP_PORTABLE_HOME")
    if portable_home:
        log_dir = Path(portable_home) / "runtime" / "BLE" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        logger.add(log_dir / "ble_collector_{time:YYYYMMDD_HHmmss}.log", level="DEBUG", encoding="utf-8")


async def list_ble_devices(timeout=8.0):
    setup_logging()
    logger.info("scanning BLE devices for {:.1f}s...", float(timeout))
    devices = await BleakScanner.discover(timeout=float(timeout))
    if not devices:
        logger.warning("no BLE devices found. Check Bluetooth, device power, and Windows permissions.")
        return
    logger.info("found {} BLE device(s):", len(devices))
    for device in devices:
        logger.info("name={!r} address={} details={}", device.name, device.address, device.details)


# class protocol_bucket:
#     def __init__(self):
#         self.cache = {}
#
#     def get(self, key):
#         return self.cache.get(key, None)
#
#     def set(self, key, value):
#         self.cache[key] = value
#
#     def delete(self, key):
#         if key in self.cache:
#             del self.cache[key]
#
#         # 使用示例
class BleReceiver:
    """
    低功耗蓝牙，脑电头环数据接收程序，解析包括 包头数据
    """
    instance = None
    def __init__(self, ble_name):
        self.ble_name = ble_name
        self.num=0
        self.time=None
        self.dyntime=None
        self.ble_device = None
        self.begain=False
        # 修改数据传输模式 标志位
        self.change_mode = False
        self.info = StreamInfo('BCIPro', 'EEG', 1, 250, 'float32', 'myuid34234')
        self.outlet = StreamOutlet(self.info)
        self.index_temp = 0
        # 新增：sample统计相关变量
        self.sample_count = 0  # 每秒收到的sample数量
        self.last_print_time = time.time()  # 上次打印时间
    # 单例模式
    def __new__(cls, *args, **kwargs):
        if cls.instance is None:
            cls.instance = object.__new__(cls)
        return cls.instance
    @classmethod
    def get_instance(cls):
        return cls.instance
    @staticmethod
    async def init_config(client, change_mode=False):
        # 初始化配置
        res = await client.read_gatt_char(ble_config_uuid)
        hex_data = res.hex()
        # header, tail = hex_data[0:4], hex_data[98:100]
        # # 校验头部、尾部
        # if header == "ccdd" and tail == "ee":
        #     mode = hex_data[4:8]
        #     if mode == "0000":
        #         logger.debug("当前是数据传输模式！")
        #     else:
        #         logger.debug("当前是阻抗检测模式！")
        #     if change_mode:
        #         # 模式取反
        #         if mode == "0000":
        #             logger.debug("修改为阻抗检测模式")
        #             to_mode = "0001"
        #         else:
        #             logger.debug("修改为数据传输模式")
        #             to_mode = "0000"
        #         change_hex_data = list(hex_data)
        #         change_hex_data[4:8] = to_mode
        #         change_str = "".join(change_hex_data)
        #         await client.write_gatt_char(ble_config_uuid, binascii.a2b_hex(change_str))
        # else:
        #     logger.error("参数配置数据校验失败，请检查！！")
    async def receiver_data(self):
        ####连接设备
        logger.info("starting BLE collector, target name={!r}", self.ble_name)
        logger.info("starting scan...")
        ble_device = await BleakScanner.find_device_by_name(self.ble_name, timeout=12.0)
        if ble_device is None:
            logger.error("could not find device with name '{}'".format(self.ble_name))
            logger.info("nearby BLE devices:")
            devices = await BleakScanner.discover(timeout=5.0)
            if not devices:
                logger.info("  none")
            for device in devices:
                logger.info("  name={!r} address={}", device.name, device.address)
            return
        logger.info("connecting to device...{}".format(self.ble_name))
        self.ble_device = ble_device
        # 处理脑电数据
        async with BleakClient(self.ble_device) as client:
            logger.info("connected")
            
            # 打印所有蓝牙服务和特征值
            logger.info("打印所有蓝牙服务和特征值：")
            for service in client.services:
                # 只打印有3个特征值且至少有一个特征值具有read功能的服务
                if len(service.characteristics) == 3:
                    # 检查是否有特征值支持read
                    has_read_characteristic = any("read" in char.properties for char in service.characteristics)
                    if has_read_characteristic:
                        logger.info(f"\n服务UUID: {service.uuid}")
                        
                        # 将服务UUID赋予给service_uuid
                        global service_uuid
                        service_uuid = service.uuid
                        
                        # 将第一个特征值UUID赋予给ble_config_uuid
                        global ble_config_uuid
                        ble_config_uuid = service.characteristics[0].uuid
                        
                        # 将第二个特征值UUID赋予给eeg_notify_uuid
                        global eeg_notify_uuid
                        eeg_notify_uuid = service.characteristics[1].uuid
                        
                        # 打印赋值结果
                        logger.info(f"\n变量赋值结果：")
                        logger.info(f"service_uuid = {service_uuid}")
                        logger.info(f"ble_config_uuid = {ble_config_uuid}")
                        logger.info(f"eeg_notify_uuid = {eeg_notify_uuid}")
                        
                        for char in service.characteristics:
                            logger.info(f"\n  特征值UUID: {char.uuid}")
                            logger.info(f"  特征值句柄: {char.handle}")
                            logger.info(f"  特征值属性: {char.properties}")
                            
                            # 尝试读取特征值（如果支持读取）
                            if "read" in char.properties:
                                try:
                                    value = await client.read_gatt_char(char.uuid)
                                    logger.info(f"  特征值数据: {value.hex() if value else '空'}")
                                except Exception as e:
                                    logger.warning(f"  读取特征值失败: {e}")
                
            # await self.init_config(client)
            self.time=time.time()
            
            # 检查eeg_notify_uuid是否已经被正确赋值
            if eeg_notify_uuid and eeg_notify_uuid != "":
                await client.start_notify(eeg_notify_uuid, self.notification_handler)
            else:
                logger.error("没有找到符合条件的服务或特征值，无法启动通知")
                return
            while 1:
                if self.change_mode:
                    await self.init_config(client, change_mode=True)
                    self.change_mode = False
                
                # 新增：每秒打印一次收到的sample数量
                current_time = time.time()
                if current_time - self.last_print_time >= 1.0:
                    # print(f"每秒收到sample数量: {self.sample_count}")
                    self.sample_count = 0  # 重置计数器
                    self.last_print_time = current_time
                
                await asyncio.sleep(0.1)  # 缩短睡眠时间，提高检测精度
            # 关闭 监听
            await client.stop_notify(eeg_notify_uuid)
            logger.info("disconnecting...")
        logger.info("disconnected")
    def notification_handler(self,sender, data):
        hex_body=data[2:122]#2到122共120字节，每三个字节解析成一个整数
        eeg_data = parse_egg(hex_body)

        # eeg_data=eeg_data.astype('float32')

        # if data[141] - self.index_temp != 1 and data[141] - self.index_temp != -127:
        #     print("index lost"+"temp",data[141],self.index_temp)
        self.index_temp = data[141]

        self.dyntime=time.time()
        for sample in eeg_data:
            # sample[1]=0
            self.outlet.push_sample([sample[0].tolist()])#每次解析出的数据分五次发送
            print([sample[0].tolist()])
            self.sample_count += 1  # 新增：更新sample计数
        # print("采样样本点:{},采集时间:{}".format(self.num, self.dyntime - self.time))
        #self.aa = self.aa + (self.dyntime - self.time)
        self.time = self.dyntime
        # self.bb += 1
        # if self.bb == 50:
        #     print(self.aa)
        #     self.bb = 0
        #     self.aa = 0


  



if __name__ == "__main__":
    setup_logging()
    if "--list-devices" in sys.argv:
        asyncio.run(list_ble_devices())
        raise SystemExit(0)
    #name = "BCI_BLE_34EAC382"
    name = os.environ.get("SSVEP_BLE_NAME") or "BCI_BLE_93D58CE2"
    if len(sys.argv) > 1 and sys.argv[1].strip():
        name = sys.argv[1].strip()
    ble_receiver = BleReceiver(name)
    asyncio.run(ble_receiver.receiver_data())

