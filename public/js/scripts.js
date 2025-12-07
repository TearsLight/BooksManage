const API_BASE = 'http://localhost:3000/api';
let currentBookIndex = null;

// 显示消息
function showMessage(text, type = 'success') {
    const message = document.getElementById('message');
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = 'block';
    setTimeout(() => {
        message.style.display = 'none';
    }, 3000);
}

// 加载所有书籍
async function loadBooks() {
    try {
        const response = await fetch(`${API_BASE}/books`);
        const result = await response.json();
        
        if (result.success) {
            displayBooks(result.data);
        } else {
            showMessage('加载书籍失败', 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
}

// 显示书籍列表
function displayBooks(books) {
    const booksList = document.getElementById('booksList');
    
    if (books.length === 0) {
        booksList.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
                <p>暂无书籍，快去添加一本吧！</p>
            </div>
        `;
        return;
    }
    
    booksList.innerHTML = books.map((book, index) => `
        <div class="book-card">
            <h3>📕 ${book.book}</h3>
            <div class="book-info"><strong>作者：</strong>${book.author}</div>
            <div class="book-info"><strong>简介：</strong>${book.summary}</div>
            <div class="book-info"><strong>发布日期：</strong>${book.subDate}</div>
            <div class="book-actions">
                <button class="btn btn-info btn-sm" onclick="viewContent(${index})">查看内容</button>
                <button class="btn btn-warning btn-sm" onclick="editBook(${index})">编辑</button>
                <button class="btn btn-danger btn-sm" onclick="deleteBook(${index})">删除</button>
            </div>
        </div>
    `).join('');
}

// 添加书籍
document.getElementById('addBookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        book: document.getElementById('book').value,
        author: document.getElementById('author').value,
        summary: document.getElementById('summary').value,
        subDate: document.getElementById('subDate').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/books`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('书籍添加成功！', 'success');
            document.getElementById('addBookForm').reset();
            loadBooks();
        } else {
            showMessage('添加失败: ' + (result.errors ? result.errors.join(', ') : result.message), 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
});

// 编辑书籍
function editBook(index) {
    fetch(`${API_BASE}/books`)
        .then(res => res.json())
        .then(result => {
            if (result.success && result.data[index]) {
                const book = result.data[index];
                document.getElementById('editIndex').value = index;
                document.getElementById('editBook').value = book.book;
                document.getElementById('editAuthor').value = book.author;
                document.getElementById('editSummary').value = book.summary;
                document.getElementById('editSubDate').value = book.subDate;
                document.getElementById('editModal').classList.add('active');
            }
        });
}

// 提交编辑
document.getElementById('editBookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const index = document.getElementById('editIndex').value;
    const formData = {
        book: document.getElementById('editBook').value,
        author: document.getElementById('editAuthor').value,
        summary: document.getElementById('editSummary').value,
        subDate: document.getElementById('editSubDate').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/books/${index}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('书籍更新成功！', 'success');
            closeEditModal();
            loadBooks();
        } else {
            showMessage('更新失败: ' + (result.errors ? result.errors.join(', ') : result.message), 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
});

// 删除书籍
async function deleteBook(index) {
    if (!confirm('确定要删除这本书吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/books/${index}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('书籍删除成功！', 'success');
            loadBooks();
        } else {
            showMessage('删除失败: ' + result.message, 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
}

// 查看内容
function viewContent(index) {
    currentBookIndex = index;
    document.getElementById('contentDisplay').textContent = '点击上方按钮读取内容...';
    document.getElementById('newContent').value = '';
    document.getElementById('contentModal').classList.add('active');
}

// 读取内容
async function readContent(mode) {
    const display = document.getElementById('contentDisplay');
    display.innerHTML = '<div class="loading"></div> 读取中...';
    
    try {
        const response = await fetch(`${API_BASE}/books/${currentBookIndex}/content?mode=${mode}`);
        const result = await response.json();
        
        if (result.success) {
            display.textContent = `[${result.mode}模式读取]\n\n${result.content}`;
        } else {
            display.textContent = '读取失败: ' + result.message;
        }
    } catch (error) {
        display.textContent = '网络错误: ' + error.message;
    }
}

// 写入内容
async function writeContent() {
    const content = document.getElementById('newContent').value;
    
    if (!content.trim()) {
        alert('请输入要写入的内容');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/books/${currentBookIndex}/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('内容写入成功！', 'success');
            document.getElementById('newContent').value = '';
            readContent('async'); // 重新读取显示
        } else {
            showMessage('写入失败: ' + result.message, 'error');
        }
    } catch (error) {
        showMessage('网络错误: ' + error.message, 'error');
    }
}

// 关闭模态框
function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

function closeContentModal() {
    document.getElementById('contentModal').classList.remove('active');
    currentBookIndex = null;
}

// 点击模态框外部关闭
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// 页面加载时获取书籍列表
loadBooks();