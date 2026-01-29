# MaaS 接入文档

> 本文档记录 Dramagic 项目使用的 MaaS（Model as a Service）服务来源及相关信息。
> 
> ⚠️ **注意**：Token 和密钥等敏感信息请在本地 .env 文件中配置，不要提交到代码仓库。

---

## 1. [Toapis](https://toapis.com/)

- **账号**：（私有）
- **密码**：Google 自动钥匙
- **Token**：配置在 `.env` 文件中
- **价格**：
  - sora：$0.0250/次
  - sora-2-pro：$0.6000/次

---

## 2. [Comfly Chat](https://ai.comfly.chat/token)

- **账号**：（私有）
- **密码**：Google 自动钥匙
- **Token**：配置在 `.env` 文件中
  - 廉价（逆向）：`COMFLY_API_KEY`
  - OpenAI 官方：`COMFLY_API_KEY_PREMIUM`
  - Original 版：`COMFLY_API_KEY_ORIGINAL`
- **API 名称（在本项目中）**：`ai.comfly.chat.sora-2`
- **价格**：
  - 廉价版（逆向）：¥0.12/次
  - OpenAI 官方：¥0.48/秒
  - Original 版：¥0.876/秒
  - Pro：¥2.5/次

---

## 3. [Fal AI](https://fal.ai/)

- **账号**：（私有）
- **密码**：Google 邮箱直接登录
- **Token**：配置在 `.env` 文件中（`FAL_KEY`）
- **API 名称（在本项目中）**：`fal-ai/sora-2/text-to-video`
- **文档**：https://fal.ai/models/fal-ai/sora-2/text-to-video/api
- **价格**：
  - sora-2：$0.1/s
  - 支持 720p 分辨率
  - 支持 4/8/12 秒时长
- **支持参数**：
  - resolution: "720p"
  - aspect_ratio: "9:16", "16:9"
  - duration: 4, 8, 12（秒）
  - model: "sora-2", "sora-2-2025-12-08", "sora-2-2025-10-06"

---

## 4. [阿里云 OSS](https://www.aliyun.com/product/oss)

- **AccessKey ID**：配置在 `.env` 文件中（`OSS_ACCESS_KEY_ID`）
- **AccessKey Secret**：配置在 `.env` 文件中（`OSS_ACCESS_KEY_SECRET`）
- **Bucket**：配置在 `.env` 文件中（`OSS_BUCKET`）
- **Region**：配置在 `.env` 文件中（`OSS_REGION`）
