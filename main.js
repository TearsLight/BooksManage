
/*
模块划分
fs模块 → 文件读写操作（book.json 和 ./书籍/*.txt）
path模块 → 路径管理
http模块 → 创建Web服务器，处理HTTP请求

用 url.parse() 分离路径和查询参数
用流式读取处理 POST/PUT 数据
为方便前后端分离 开发允许跨域请求
可以使用用正则加上字符串判断实现简单路由

JSON 格式统一
所有 API 响应都用统一格式
{
    success: true/false,  操作是否成功
    data: {},             成功时的数据
    message: "",          提示信息
    errors: []            验证错误数组
}
这样前端可以统一处理响应还有易于调试

RESTful API 设计
GET    /api/books                 查询所有 - Read All
POST   /api/books                 创建新的 - Create
PUT    /api/books/:index          更新指定 - Update
DELETE /api/books/:index          删除指定 - Delete
GET    /api/books/:index/content  读取文件内容
POST   /api/books/:index/content  写入文件内容

book.json 是数组结构，可以使用索引

同步/异步设计
同步操作用于需要立即返回结果的场景
readBooks() → fs.readFileSync()    读取 book.json
writeBooks() → fs.writeFileSync()  写入 book.json

异步操作用于不阻塞主线程的场景  
读取书籍内容 → fs.readFile()        可选 sync/async 模式
写入书籍内容 → fs.writeFile()       异步写入
book.json 是核心数据，操作频繁且需要立即确认结果
书籍内容用异步，里面的数据可能很大，避免阻塞服务器

参数校验中间件设计
中间件要求有独立的验证函数
添加新规则只需增加判断
validateBookData(data) {
    返回错误数组，而不是 true/false，可以一次性显示所有错误
    return ['书籍名称不能为空', '日期格式不正确']
}

静态文件服务思路
if (!pathname.startsWith('/api/')) {
    非API请求 = 静态文件请求
    根据扩展名判断 MIME 类型
    读取文件
    返回正确的 Content-Type
}
用 path.extname() 获取扩展名
维护 mimeTypes 映射表
区分 API 和静态文件使用/api/前缀

错误处理
使用三层错误处理
try-catch → 捕获 JSON 解析错误
fs 回调 → 捕获文件操作错误
HTTP 状态码 → 告知客户端错误类型
    400: 客户端参数错误
    404: 资源不存在
    500: 服务器内部错误


前端设计

即时反馈 → 操作后立即显示成功/失败消息
防误操作 → 删除前弹出确认框
模态框 → 编辑/查看内容不跳转页面
空状态提示 → 没有书籍时显示友好提示

交互

添加书籍 → 表单提交 → API 调用 → 刷新列表
编辑书籍 → 打开模态框 → 回填数据 → 提交更新
查看内容 → 模态框 → 同步/异步读取 → 可写入新内容


数据流设计

用户操作 → 前端表单
    ↓
前端验证
    ↓
HTTP 请求 → 后端接口
    ↓
后端验证，即中间件
    ↓
文件操作
    ↓
JSON 响应 → 前端
    ↓
更新界面 + 提示消息

文件路径管理思路
使用 path.join
path.join(__dirname, '书籍', `book_${i}.txt`)：
这样可以避免路径注入攻击，并自动处理多余的斜杠

OK，理论成立，开始实战
*/

// 引入模块
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 配置全局常量的参数
// 端口号
const PORT = 3000;
// 书籍数据文件路径
const BOOK_JSON_PATH = path.join(__dirname, 'book.json');
// 书籍文件目录
const BOOK_DIR = path.join(__dirname, '书籍');
// 公共资源目录
const PUBLIC_DIR = path.join(__dirname, 'public');

// 目录存在检测
if (!fs.existsSync(BOOK_DIR)) {
  // 若不存在 则创建
    fs.mkdirSync(BOOK_DIR, { recursive: true });
}

// 读取书籍数据
function readBooks() {
    try {
        // sync同步读取
        const data = fs.readFileSync(BOOK_JSON_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取书籍数据失败:', error);
        return [];
    }
}

// 写入书籍数据
function writeBooks(books) {
    try {
        fs.writeFileSync(BOOK_JSON_PATH, JSON.stringify(books, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('写入书籍数据失败:', error);
        return false;
    }
}

// 中间件参数校验
function validateBookData(data) {
    const errors = [];
    
    if (!data.book || data.book.trim() === '') {
        errors.push('书籍名称不能为空');
    }
    if (!data.author || data.author.trim() === '') {
        errors.push('作者名不能为空');
    }
    if (!data.summary || data.summary.trim() === '') {
        errors.push('书籍简介不能为空');
    }
    if (!data.subDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.subDate)) {
        errors.push('发布日期格式不正确，应为YYYY-MM-DD');
    }
    
    return errors;
}

// 创建服务器
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    
    // 设置跨域头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      //返回200状态码
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 静态文件托管
    if (!pathname.startsWith('/api/')) {
        // 处理根路径
        let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
        
        // 文件扩展名
        const extname = path.extname(filePath).toLowerCase();
        
        // 设置Content-Type
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };
        
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        
        // 读取并返回文件内容
        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('文件未找到');
                } else {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('服务器错误');
                }
            } else {
                res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
                res.end(data);
            }
        });
        return;
    }
    
    // API路由
    // 增————添加书籍  POST /api/books
    if (pathname === '/api/books' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const newBook = JSON.parse(body);
                const errors = validateBookData(newBook);
                
                if (errors.length > 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, errors }));
                    return;
                }
                
                const books = readBooks();
                books.push(newBook);
                
                if (writeBooks(books)) {
                    // 创建文件
                    const bookIndex = books.length;
                    const bookFilePath = path.join(BOOK_DIR, `book_${bookIndex}.txt`);
                    fs.writeFileSync(bookFilePath, `This is book NO.${bookIndex}`, 'utf8');
                    
                    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, message: '书籍添加成功', data: newBook }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: '保存失败' }));
                }
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: '无效的JSON格式' }));
            }
        });
        return;
    }
    // 删————删除书籍  DELETE /api/books/:index
    if (pathname.startsWith('/api/books/') && req.method === 'DELETE') {
        const index = parseInt(pathname.split('/')[3]);
        const books = readBooks();
        
        if (index < 0 || index >= books.length) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: '书籍不存在' }));
            return;
        }
        
        const deletedBook = books.splice(index, 1)[0];
        
        if (writeBooks(books)) {
            // 删除对应的书籍文件
            const bookFilePath = path.join(BOOK_DIR, `book_${index + 1}.txt`);
            if (fs.existsSync(bookFilePath)) {
                fs.unlinkSync(bookFilePath);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: '书籍删除成功', data: deletedBook }));
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: '删除失败' }));
        }
        return;
    }
    
    // 改————更新书籍  PUT /api/books/:index
    if (pathname.startsWith('/api/books/') && req.method === 'PUT') {
        const index = parseInt(pathname.split('/')[3]);
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const updatedBook = JSON.parse(body);
                const errors = validateBookData(updatedBook);
                
                if (errors.length > 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, errors }));
                    return;
                }
                
                const books = readBooks();
                
                if (index < 0 || index >= books.length) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: '书籍不存在' }));
                    return;
                }
                
                books[index] = updatedBook;
                
                if (writeBooks(books)) {
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, message: '书籍更新成功', data: updatedBook }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: '更新失败' }));
                }
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: '无效的JSON格式' }));
            }
        });
        return;
    }
    // 查————获取所有书籍  GET /api/books
    if (pathname === '/api/books' && req.method === 'GET') {
        const books = readBooks();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: books }));
        return;
    }
    
    // 同/异步读取  GET /api/books/:index/content?mode=sync / async
    // 使用正则表达式匹配路径
    if (pathname.match(/^\/api\/books\/\d+\/content$/) && req.method === 'GET') {
        const index = parseInt(pathname.split('/')[3]);
        const mode = query.mode || 'async';
        const bookFilePath = path.join(BOOK_DIR, `book_${index + 1}.txt`);
        
        if (mode === 'sync') {
            // 同步读取
            try {
                if (!fs.existsSync(bookFilePath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: '书籍文件不存在' }));
                    return;
                }
                const content = fs.readFileSync(bookFilePath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, mode: 'sync', content }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: '读取失败' }));
            }
        } else {
            // 异步读取
            fs.readFile(bookFilePath, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: '书籍文件不存在或读取失败' }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, mode: 'async', content: data }));
                }
            });
        }
        return;
    }
    
    // 写入内容  POST /api/books/:index/content
    if (pathname.match(/^\/api\/books\/\d+\/content$/) && req.method === 'POST') {
        const index = parseInt(pathname.split('/')[3]);
        const bookFilePath = path.join(BOOK_DIR, `book_${index + 1}.txt`);
        
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { content } = JSON.parse(body);
                
                if (!content) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: '内容不能为空' }));
                    return;
                }
                
                fs.writeFile(bookFilePath, content, 'utf8', (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, message: '写入失败' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: true, message: '内容写入成功' }));
                    }
                });
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: '无效的JSON格式' }));
            }
        });
        return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: '接口不存在' }));
});

server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('API接口:');
    console.log('  GET     /api/books                                 - 获取所有书籍');
    console.log('  POST    /api/books                                 - 添加书籍');
    console.log('  PUT     /api/books/:index                          - 更新书籍');
    console.log('  DELETE  /api/books/:index                          - 删除书籍');
    console.log('  GET     /api/books/:index/content?mode=sync|async  - 同步/异步读取书籍内容');
    console.log('  POST    /api/books/:index/content                  - 写入书籍内容');
});