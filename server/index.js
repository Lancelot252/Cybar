const app = require('./app');

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log('========================================');
    console.log('Cybar 服务器启动成功');
    console.log(`访问地址: http://localhost:${port}`);
    console.log(`百炼 AI: ${process.env.DASHSCOPE_API_KEY ? '已配置' : '未配置（手动创建仍可用）'}`);
    console.log(`文本模型: ${process.env.AI_TEXT_MODEL || 'qwen3.7-flash'}`);
    console.log(`图片模型: ${process.env.AI_IMAGE_MODEL || 'z-image-turbo'}`);
    console.log('========================================');
});
