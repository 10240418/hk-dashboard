# HK Dashboard 部署指南

## 服务信息

| 项目 | 值 |
|------|-----|
| 域名 | apis.hk.skylinedances.com |
| HTTPS | /etc/letsencrypt/live/apis.hk.skylinedances.com/ |
| 应用服务器 | 47.239.117.108 :20036 |
| 网关服务器 | 47.83.21.100 |
| 远程目录 | /home/admin/hk-dashboard/ |
| 服务类型 | 纯静态（无需构建） |

## 部署原则

- 修改服务器配置前，先用 `ssh` 查看原文件内容，确认格式后再改
- 静态文件同步后立即生效，无需重启 nginx/frpc 等服务
- 仅有配置变更（nginx/frpc）才需要 reload/restart

## 部署/更新

### 1. 同步文件到应用服务器

```bash
rsync -avz --exclude='.git' --exclude='screenshots' --exclude='.github' \
  /Users/yangliu/Documents/Code/hk-dashboard/ \
  admin@47.239.117.108:/home/admin/hk-dashboard/
```

同步完成后立即生效，无需重启任何服务。

### 2. 验证

```bash
curl -sI https://apis.hk.skylinedances.com | head -5
```

## 请求链路

```
浏览器 --HTTPS--> 47.83.21.100 nginx(:443 SSL终止)
  --> 127.0.0.1:80 frps --> frpc --> 47.239.117.108:20036 nginx --> 静态文件
```

## 关键配置文件位置

### 47.239.117.108（应用服务器）

- nginx 站点: /etc/nginx/sites-available/hk-dashboard
- frpc proxy: /home/admin/frp/frpc.toml（name = "hk-dashboard"）

### 47.83.21.100（网关服务器）

- nginx HTTPS: /etc/nginx/sites-available/apis_hk_ssl.conf
- SSL 证书: /etc/letsencrypt/live/apis.hk.skylinedances.com/

## SSL 续期

```bash
ssh admin@47.83.21.100 "sudo certbot renew --dry-run"
```
