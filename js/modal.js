/* js/modal.js */

function showModal(message, type = 'alert', title = '提示', buttonOrInitialValue = '确定', cancelText = '取消') {
  return new Promise(resolve => {
    let modalOverlay = document.getElementById('custom-modal-overlay');
    let modalTitleElement;
    let modalMessageElement;
    let modalInputElement; // 新增：用于引用文本输入框
    let confirmBtn;
    let cancelBtn;

    if (!modalOverlay) {
      modalOverlay = document.createElement('div');
      modalOverlay.id = 'custom-modal-overlay';
      modalOverlay.className = 'custom-modal-overlay';
      // 修改 HTML 结构，添加一个隐藏的 textarea 用于 prompt 类型
      modalOverlay.innerHTML = `
        <div class="custom-modal-content">
          <h3 id="custom-modal-title"></h3>
          <p id="custom-modal-message"></p>
          <textarea id="custom-modal-input" class="custom-modal-input hide"></textarea> <!-- 默认隐藏 -->
          <div class="custom-modal-actions">
            <button id="custom-modal-confirm-btn"></button>
            <button id="custom-modal-cancel-btn" class="hide"></button>
          </div>
        </div>
      `;
      document.body.appendChild(modalOverlay);
    }

    // 获取元素，确保在 DOM 中存在
    modalTitleElement = document.getElementById('custom-modal-title');
    modalMessageElement = document.getElementById('custom-modal-message');
    modalInputElement = document.getElementById('custom-modal-input'); // 获取文本输入框
    confirmBtn = document.getElementById('custom-modal-confirm-btn');
    cancelBtn = document.getElementById('custom-modal-cancel-btn');

    console.log('showModal called with type:', type);
    console.log('Initial modalMessageElement classList:', modalMessageElement.classList.value);
    console.log('Initial modalInputElement classList:', modalInputElement.classList.value);

    modalTitleElement.textContent = title;
    
    // 根据类型设置元素的显示状态和文本内容
    if (type === 'prompt') {
      modalMessageElement.classList.add('hide'); // 隐藏消息元素
      modalInputElement.classList.remove('hide'); // 显示输入框
      modalInputElement.value = buttonOrInitialValue; // 设置输入框的初始值
      modalInputElement.placeholder = '请输入内容...';
      confirmBtn.textContent = '确认'; // prompt 模式下确认按钮的文本
      
      // 确保输入框获取焦点并选中内容
      setTimeout(() => {
        modalInputElement.focus();
        modalInputElement.select();
      }, 50);

    } else {
      modalMessageElement.classList.remove('hide'); // 显示消息元素
      modalMessageElement.innerHTML = message; // 支持HTML内容
      modalInputElement.classList.add('hide'); // 隐藏输入框
      confirmBtn.textContent = buttonOrInitialValue; // alert/confirm 模式下确认按钮的文本
    }

    console.log('After type-specific logic:');
    console.log('modalMessageElement classList:', modalMessageElement.classList.value);
    console.log('modalInputElement classList:', modalInputElement.classList.value);
    console.log('confirmBtn textContent:', confirmBtn.textContent);

    const confirmHandler = (event) => {
      event.stopPropagation();
      modalOverlay.classList.remove('show');
      console.log('自定义模态框：确认按钮被点击');
      if (type === 'prompt') {
        resolve(modalInputElement.value); // prompt 模式返回输入框的值
      } else {
        resolve(true);
      }
      // 移除事件监听器，避免重复触发
      confirmBtn.removeEventListener('click', confirmHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
    };

    const cancelHandler = (event) => {
      event.stopPropagation();
      modalOverlay.classList.remove('show');
      console.log('自定义模态框：取消按钮被点击');
      if (type === 'prompt') {
        resolve(null); // prompt 模式取消时返回 null
      } else {
        resolve(false);
      }
      // 移除事件监听器，避免重复触发
      confirmBtn.removeEventListener('click', confirmHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
    };

    // 每次显示前移除旧的监听器
    confirmBtn.removeEventListener('click', confirmHandler);
    cancelBtn.removeEventListener('click', cancelHandler);

    // 添加新的监听器
    confirmBtn.addEventListener('click', confirmHandler);

    // confirm 和 prompt 模式都需要取消按钮
    if (type === 'confirm' || type === 'prompt') {
      cancelBtn.textContent = cancelText;
      cancelBtn.classList.remove('hide');
      cancelBtn.addEventListener('click', cancelHandler);
    } else {
      cancelBtn.classList.add('hide');
    }

    // 延迟显示模态框以触发 CSS 过渡效果
    setTimeout(() => {
      modalOverlay.classList.add('show');
    }, 10);
  });
} 