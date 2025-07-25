# 阿里云盘小白羊版

#### 项目说明

原阿里云盘小白羊版v3的延续版

基于阿里云盘网页版开发的PC客户端，支持win7-11，macOS，linux

本项目 CDN 加速及安全防护由 Tencent EdgeOne 赞助

官网链接：[亚洲最佳CDN、边缘和安全解决方案 - Tencent EdgeOne](https://edgeone.ai/zh?from=github)

![image](https://edgeone.ai/media/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png)

<br/>

> **08.25：[v3开发人员测试版](https://github.com/PingKuNet/aliyunpan/releases/tag/v3.8.25.alpha)，追加上传，优化打包**

> **04.14：[v2.12.14版已发布](https://github.com/liupan1890/aliyunpan/issues/639)，适配官网升级**

> **2022-01-02:在憋大招，耐心等待v3版**
  <br />
  
v1.6.29：[https://wwe.lanzoui.com/b01npsg8h](https://wwe.lanzoui.com/b01npsg8h)

v2.12.14：[https://wwe.lanzoui.com/b01nqc4gd](https://wwe.lanzoui.com/b01nqc4gd)

MacOS：[https://www.macwk.com/soft/aliyun-drive-xiaobaiyang](https://www.macwk.com/soft/aliyun-drive-xiaobaiyang)

Mac版由macwk.com使用自有签名打包dmg，可以简单点击安装了(不需要输入终端命令)，推荐下载此版本，已测MacOS10.12-11.4,兼容M1
<br />

已经发布在小众软件发现频道，大爱小众[meta.appinn.net](https://meta.appinn.net)

<br />

已发布了使用帮助文档 [https://www.yuque.com/liupan1890/xiaobaiyang](https://www.yuque.com/liupan1890/xiaobaiyang)

``````
2021年11月28日 已完成功能：
多账号登录、常用文件操作（新建文件夹、收藏、重命名、复制、移动、删除、详情、视频雪碧图）、
在线播放原始视频、在线播放转码视频、在线预览图片、在线预览文本、在线预览 word/excel/ppt/pdf、
连接到远程 Aria2 下载、上传文件、上传文件夹、批量改名、在线解压、回收站、收藏夹、
分享文件、导入阿里云分享链接、缩略图列表、网盘内文件搜索、视频文件洗码

等待完成的功能：
相册功能、网盘和相册间文件互相复制、文件同步盘、重复文件扫描、帐号间文件复制
``````

<br />

#

![Image](https://raw.githubusercontent.com/liupan1890/aliyunpan/main/doc/v2.10.19.png)

#

#### 为什么要用小白羊？

#### 一：因为更快

##### 上传和下载4.4万个json格式小文件（共24GB）:	

| 程序 | 总用时 | 用时基准 |
| --- | ---: | ---: |
| 上传&小白羊版 v2.10 | 24分钟 | :zap:58% |
| 上传&PC客户端 v2.2.6 | 41分钟 | 100% |
|  ... |  |  |  |  |
| 下载&小白羊版 v2.10 | 25分钟 | :zap:42% |
| 下载&PC客户端 v2.2.6  | 59分钟 | 100% |


##### 上传和下载33个大文件（共90GB）:

| 程序 | 总用时 | 用时基准 |
| --- | ---: | ---: |
| 上传&小白羊版 v2.10 | 1分10秒 | :zap:44% |
| 上传&PC客户端 v2.2.6 | 2分40秒 | 100% |
|  ... |  |  |  |  |
| 下载&小白羊版 v2.10 | 38分钟 | :zap:52% |
| 下载&PC客户端 v2.2.6 | 72分钟 | 100% |

<br/>

详情参阅 ：[v2.10.19性能测试](https://github.com/liupan1890/aliyunpan/blob/main/v2.10.19%E6%80%A7%E8%83%BD%E6%B5%8B%E8%AF%95.md) 的性能测试文档

#### 二：因为更好

小白羊支持同时登录多个账号管理

小白羊特有文件夹树，可以快速方便的操作

小白羊支持直接在线播放网盘里的各种格式的视频并且是高清原画，支持外挂字幕/音轨/播放速度调整，比官方的格式更多更清晰

小白羊可以显示文件夹体积，可以文件夹和文件混合排序(文件名/体积/时间)，并且文件名排序时更准确！

小白羊可以通过远程Aria2功能把文件直接下载到远程的VPS/NAS上

小白羊可以批量的对 大量文件/多层嵌套的文件夹 一键重命名

小白羊可以快速复制文件，可以直接预览视频的雪碧图，可以直接删除文件

小白羊支持数万文件夹和数万文件的管理，支持一次性列出文件夹里包含的全部文件

小白羊支持单次上传/下载 一百万 量级的文件/文件夹

小白羊仍在努力开发新功能，让大家使用起来更方便！

#

#### 常见问题请参阅帮助文档


#### 特别感谢 @jkqxl @iD2073 @ybbluesky 等为小白羊提供了大量的优化建议



