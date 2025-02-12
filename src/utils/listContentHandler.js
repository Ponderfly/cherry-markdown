/**
 * Copyright (C) 2021 THL A29 Limited, a Tencent company.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getValueWithoutCode, LIST_CONTENT } from '@/utils/regexp';

export default class ListHandler {
  /** @type{HTMLElement} */
  bubbleContainer = null;

  regList = LIST_CONTENT;

  /** @type{Array.<import('codemirror').Position>} */
  range = [];

  /** @type{import('codemirror').Position} */
  position = { line: 0, ch: 0 };

  /**
   * @param {string} trigger 触发方式
   * @param {HTMLParagraphElement} target 目标dom
   * @param {HTMLDivElement} container bubble容器
   * @param {HTMLDivElement} previewerDom 预览器dom
   * @param {import('../Editor').default} editor 编辑器实例
   */
  constructor(trigger, target, container, previewerDom, editor, options = {}) {
    this.trigger = trigger;
    this.target = target;
    this.container = container;
    this.previewerDom = previewerDom;
    this.editor = editor;
    this.handleEditablesInputBinded = this.handleEditablesInput.bind(this); // 保证this指向正确以及能够正确移除事件
    this.handleEditablesUnfocusBinded = this.handleEditablesUnfocus.bind(this);
    this.target.addEventListener('input', this.handleEditablesInputBinded, false);
    this.target.addEventListener('focusout', this.handleEditablesUnfocusBinded, false);
    this.setSelection();
  }

  /**
   * 触发事件
   * @param {string} type 事件类型
   * @param {Event} event 事件对象
   */
  emit(type, event) {
    switch (type) {
      case 'remove':
        return this.remove();
    }
  }

  remove() {
    if (this.bubbleContainer) {
      this.bubbleContainer.style.display = 'none';
      if (this.bubbleContainer.children[0] instanceof HTMLTextAreaElement) {
        this.bubbleContainer.children[0].value = ''; // 清空内容
      }
    }
    this.target.removeAttribute('contenteditable');
    this.target.removeEventListener('input', this.handleEditablesInputBinded, false);
    this.target.removeEventListener('focusout', this.handleEditablesUnfocusBinded, false);
    const cursor = this.editor.editor.getCursor(); // 获取光标位置
    this.editor.editor.setSelection(cursor, cursor); // 取消选中
  }

  setSelection() {
    const allLi = Array.from(this.previewerDom.querySelectorAll('li')); // 预览区域内所有的li
    const targetLiIdx = allLi.findIndex((li) => li === this.target.parentElement);
    if (targetLiIdx === -1) {
      return; // 没有找到li
    }
    const contents = getValueWithoutCode(this?.editor.editor.getValue())?.split('\n') ?? [];
    let contentsLiCount = 0; // 编辑器中是列表的数量
    let targetLine = -1; // 行
    let targetCh = -1; // 列
    let targetContent = ''; // 当前点击的li的内容
    contents.forEach((lineContent, lineIdx) => {
      // 匹配是否符合列表的正则
      const regRes = this.regList.exec(lineContent);
      if (regRes !== null) {
        if (contentsLiCount === targetLiIdx && regRes[1] !== undefined) {
          targetLine = lineIdx;
          // eslint-disable-next-line prefer-destructuring
          targetContent = regRes[4]; // 这里只取一个没必要解构
          targetCh = lineContent.indexOf(targetContent);
        }
        contentsLiCount += 1;
      }
    });
    const from = { line: targetLine, ch: targetCh };
    const to = { line: targetLine, ch: targetCh + targetContent.length };
    this.editor.editor.setSelection(from, to);
    this.range = [from, to];
    this.position = this.editor.editor.getCursor(); // 输入就获取光标位置，防止后面点到编辑器dom的时候光标位置不对
  }

  /**
   * 处理contenteditable元素的输入事件
   * @param {InputEvent} event
   */
  handleEditablesInput(event) {
    event.stopPropagation();
    event.preventDefault();
    /** @typedef {'insertText'|'insertFromPaste'|'insertParagraph'|'insertLineBreak'|'deleteContentBackward'|'deleteContentForward'|'deleteByCut'|'deleteContentForward'|'deleteWordBackward'} InputType*/
    if (event.target instanceof HTMLParagraphElement) {
      if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
        this.handleInsertLineBreak();
      }
    }
  }

  /**
   * 处理contenteditable元素的失去焦点事件
   * @param {FocusEvent} event
   */
  handleEditablesUnfocus(event) {
    event.stopPropagation();
    event.preventDefault();
    if (event.target instanceof HTMLParagraphElement) {
      console.log('event', event);
      const md = this.editor.$cherry.engine.makeMarkdown(event.target.innerHTML);
      console.log('md', md);
      const [from, to] = this.range;
      this.editor.editor.replaceRange(md, from, to);
      this.remove();
    }
  }

  handleInsertLineBreak() {
    // 获取当前光标位置
    const cursor = this.editor.editor.getCursor();
    // 获取光标行的内容
    const lineContent = this.editor.editor.getLine(cursor.line);
    const regRes = this.regList.exec(lineContent);
    let insertContent = '\n- ';
    if (regRes !== null) {
      // 存在选中的checkbox则替换为未选中的checkbox，其他的保持原样
      insertContent = `\n${regRes[1]}${regRes[2]?.replace('[x]', '[ ] ')}`;
    }
    // 在当前行的末尾插入一个换行符，这会创建一个新行
    this.editor.editor.replaceRange(insertContent, {
      line: cursor.line,
      ch: this.editor.editor.getLine(cursor.line).length,
    });
    // 将光标移动到新行
    this.editor.editor.setCursor({ line: cursor.line + 1, ch: insertContent.length + 1 });
    // 将光标聚焦到编辑器上
    this.editor.editor.focus();
    this.remove();
  }
}
