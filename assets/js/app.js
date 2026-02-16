    const STORAGE_TTL_MS = 12 * 60 * 60 * 1000;
    const ALLOWED_WORKFLOW_STATUS = ['todo', 'doing', 'review', 'back', 'done'];

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function normalizeWorkflowStatus(status) {
      return ALLOWED_WORKFLOW_STATUS.includes(status) ? status : 'todo';
    }

    function clearElementChildren(element) {
      if (!element) return;
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }

    function setStoredJson(key, value) {
      const payload = {
        savedAt: Date.now(),
        value
      };
      localStorage.setItem(key, JSON.stringify(payload));
    }

    function getStoredJson(key, maxAgeMs = STORAGE_TTL_MS) {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw);
        if (
          parsed
          && typeof parsed === 'object'
          && Object.prototype.hasOwnProperty.call(parsed, 'value')
          && typeof parsed.savedAt === 'number'
        ) {
          if (Date.now() - parsed.savedAt > maxAgeMs) {
            localStorage.removeItem(key);
            return null;
          }
          return parsed.value;
        }
        return parsed;
      } catch {
        localStorage.removeItem(key);
        return null;
      }
    }

    // 言語切り替え
    function setLanguage(lang, btn) {
      document.body.setAttribute('data-lang', lang);
      document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
      if (btn) {
        btn.classList.add('active');
      }

      // プレースホルダーの更新
      updatePlaceholders(lang);

      // 締めくくり質問の更新
      const closingQ = document.getElementById('closingQuestion');
      if (closingQ) {
        closingQ.value = lang === 'ja'
          ? '他に伝えておきたいことはありますか？'
          : 'Is there anything else you would like to share?';
      }

      // 工程表テーブルの言語更新
      updateWorkflowTableLanguage(lang);

      // 依存関係の警告も言語に合わせて更新
      checkDependencies();

      // カンバン/ガントビューが表示中なら再描画
      if (typeof currentWorkflowView !== 'undefined') {
        if (currentWorkflowView === 'kanban') renderKanbanView();
        else if (currentWorkflowView === 'gantt') renderGanttView();
      }

      // 言語設定を保存
      localStorage.setItem('prWorkflowLang', lang);
    }

    // 工程表テーブルの翻訳マッピング
    const workflowTranslations = {
      phases: {
        '企画・構成': 'Planning',
        '取材・素材': 'Research & Materials',
        '原稿作成': 'Writing',
        '編集・組版': 'Design & Layout',
        '校正1（初校）': 'Proofreading 1',
        '校正2（再校）': 'Proofreading 2',
        '校正3（三校）': 'Proofreading 3',
        '色校正': 'Color Proof',
        '入稿・公開': 'Submission & Publication'
      },
      tasks: {
        '目的/ゴールの明確化': 'Define purpose/goals',
        'ターゲット/ペルソナ設定': 'Set target/persona',
        '競合/類似物調査': 'Competitor research',
        'コアメッセージ決定': 'Define core message',
        '構成案/台割作成': 'Create outline/structure',
        'スケジュール/予算確定': 'Finalize schedule/budget',
        '企画承認': 'Approve plan',
        '取材対象者リスト作成': 'Create interviewee list',
        '取材質問設計': 'Design interview questions',
        '取材アポイント調整': 'Schedule interviews',
        '取材実施/記録': 'Conduct interviews',
        '文字起こし/記録整理': 'Transcription/organize notes',
        '写真/素材撮影・収集': 'Photo/material collection',
        '素材の不足確認/追加入手': 'Check/obtain missing materials',
        '初稿執筆': 'Write first draft',
        'キャッチ/見出し案作成': 'Create headlines/copy',
        '内部レビュー（文章）': 'Internal review (text)',
        '修正/第2稿作成': 'Revisions/second draft',
        '対象者/関係者確認': 'Subject/stakeholder review',
        '原稿確定': 'Finalize manuscript',
        'デザインコンセプト決定': 'Define design concept',
        'ラフレイアウト作成': 'Create rough layout',
        '写真/図版選定・配置': 'Select/place photos',
        '初稿組版作成': 'First typeset draft',
        '内部レビュー（デザイン）': 'Internal review (design)',
        'デザイン修正': 'Design revisions',
        'デザイン確定': 'Finalize design',
        '初校チェック': 'First proof check',
        '初校赤字反映': 'Apply first corrections',
        '再校チェック': 'Second proof check',
        '再校赤字反映': 'Apply second corrections',
        '三校チェック': 'Third proof check',
        '三校赤字反映': 'Apply third corrections',
        '色校正出し/確認': 'Color proof check',
        '色校正戻し/確定': 'Finalize color proof',
        '入稿データ作成': 'Prepare submission data',
        '印刷発注/公開準備': 'Print order/publish prep',
        '校了/最終承認': 'Final approval',
        '納品/公開': 'Delivery/publication',
        '配布/告知': 'Distribution/announcement'
      },
      statuses: {
        '未着手': 'Not Started',
        '進行中': 'In Progress',
        'レビュー待ち': 'In Review',
        '差し戻し': 'Returned',
        '完了': 'Done'
      },
      buttons: {
        '削除': 'Delete'
      }
    };

    // 工程表テーブルの言語更新
    function updateWorkflowTableLanguage(lang) {
      const rows = document.querySelectorAll('.workflow-row');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          // フェーズ名（1列目）
          const phaseCell = cells[0];
          const phaseText = phaseCell.dataset.textJa || phaseCell.textContent.trim();
          if (!phaseCell.dataset.textJa) {
            phaseCell.dataset.textJa = phaseText;
          }
          // ドラッグハンドル以外のテキストノードを更新
          const textNodes = [...phaseCell.childNodes].filter(n => n.nodeType === Node.TEXT_NODE);
          if (textNodes.length > 0) {
            const enText = workflowTranslations.phases[phaseCell.dataset.textJa] || phaseCell.dataset.textJa;
            textNodes[0].textContent = lang === 'ja' ? phaseCell.dataset.textJa : enText;
          }

          // タスク名（2列目） — ガイダンスボタン(?)と警告spanを保持したまま更新
          const taskCell = cells[1];
          // 初回は日本語テキストを保存（ボタン・警告を除いたテキストのみ）
          if (!taskCell.dataset.textJa) {
            const clone = taskCell.cloneNode(true);
            const rmEls = clone.querySelectorAll('.task-info-btn, .dependency-warning');
            rmEls.forEach(el => el.remove());
            taskCell.dataset.textJa = clone.textContent.trim();
          }
          const enTask = workflowTranslations.tasks[taskCell.dataset.textJa] || taskCell.dataset.textJa;
          const newText = lang === 'ja' ? taskCell.dataset.textJa : enTask;
          // 子要素（ボタン・警告）を退避→テキスト更新→子要素を再追加
          const preservedEls = taskCell.querySelectorAll('.task-info-btn, .dependency-warning');
          const savedEls = [...preservedEls];
          taskCell.textContent = newText;
          savedEls.forEach(el => taskCell.appendChild(el));
        }

        // ステータス選択肢
        const statusSelect = row.querySelector('.workflow-status');
        if (statusSelect) {
          statusSelect.querySelectorAll('option').forEach(opt => {
            const jaText = opt.dataset.textJa || opt.textContent.trim();
            if (!opt.dataset.textJa) {
              opt.dataset.textJa = jaText;
            }
            const enText = workflowTranslations.statuses[opt.dataset.textJa] || opt.dataset.textJa;
            opt.textContent = lang === 'ja' ? opt.dataset.textJa : enText;
          });
        }

        // 削除ボタン
        const deleteBtn = row.querySelector('.remove-row-btn');
        if (deleteBtn) {
          const jaText = deleteBtn.dataset.textJa || deleteBtn.textContent.trim();
          if (!deleteBtn.dataset.textJa) {
            deleteBtn.dataset.textJa = jaText;
          }
          deleteBtn.textContent = lang === 'ja' ? jaText : workflowTranslations.buttons[jaText] || jaText;
        }
      });
    }

    // プレースホルダーの更新
    function updatePlaceholders(lang) {
      document.querySelectorAll('[data-placeholder-ja]').forEach(el => {
        const placeholder = lang === 'ja' ? el.dataset.placeholderJa : el.dataset.placeholderEn;
        if (placeholder) {
          el.placeholder = placeholder;
        }
      });
    }

    // タブ切り替え
    function showPanel(panelId, btn) {
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById(panelId).classList.add('active');
      if (btn) {
        btn.classList.add('active');
      }
    }

    // フェーズの開閉
    function togglePhase(phaseNum) {
      const content = document.getElementById(`phase${phaseNum}Content`);
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    }

    function setAllPhases(open) {
      for (let i = 1; i <= 6; i++) {
        const content = document.getElementById(`phase${i}Content`);
        if (content) {
          content.style.display = open ? 'block' : 'none';
        }
      }
    }

    function toggleWorkflowCompact() {
      const lists = document.querySelectorAll('.task-list');
      const isCompact = lists.length > 0 && lists[0].classList.contains('compact');
      lists.forEach(list => list.classList.toggle('compact', !isCompact));
      const btn = document.getElementById('workflowCompactBtn');
      if (btn) {
        btn.innerHTML = !isCompact
          ? '<span class="lang-ja">標準表示</span><span class="lang-en">Standard View</span>'
          : '<span class="lang-ja">コンパクト表示</span><span class="lang-en">Compact View</span>';
      }
    }

    function setInterviewType(type) {
      const hint = document.getElementById('interviewTypeHint');
      if (!hint) return;
      if (type === 'request') {
        hint.innerHTML = '<span class="lang-ja">原稿依頼として回答を受け取る前提で、必要事項を記入します。</span><span class="lang-en">Use this when requesting written responses instead of live interviews.</span>';
      } else {
        hint.innerHTML = '<span class="lang-ja">直接話を聞く前提の質問とフォローを記録します。</span><span class="lang-en">Use this for live interviews with follow-up questions.</span>';
      }

      document.querySelectorAll('[data-interview-type]').forEach(block => {
        const shouldShow = block.dataset.interviewType === type;
        block.style.display = shouldShow ? 'block' : 'none';
      });

      if (type === 'direct') {
        updateQuestionNumbers('direct');
      } else {
        updateQuestionNumbers('request');
      }
    }

    function addInterviewee() {
      const list = document.getElementById('intervieweeList');
      const template = document.getElementById('intervieweeTemplate');
      if (!list || !template) return;
      const node = template.content.cloneNode(true);
      list.appendChild(node);
      updateIntervieweeIndexes();
    }

    function removeInterviewee(button) {
      const card = button.closest('.interviewee-card');
      if (card) {
        card.remove();
        updateIntervieweeIndexes();
      }
    }

    function updateIntervieweeIndexes() {
      const indexes = document.querySelectorAll('.interviewee-card .interviewee-index');
      indexes.forEach((el, i) => {
        el.textContent = i + 1;
      });
    }

    function addQuestionItem(type, presetText) {
      const listId = type === 'request' ? 'requestQuestionList' : 'directQuestionList';
      const list = document.getElementById(listId);
      if (!list) return;
      const item = document.createElement('div');
      item.className = 'question-item';

      const header = document.createElement('div');
      header.className = 'question-item-header';
      const title = document.createElement('div');
      title.className = 'question-item-title';
      const badge = document.createElement('span');
      badge.className = 'question-badge';
      badge.textContent = type === 'request' ? 'R' : 'Q';
      const label = document.createElement('span');
      label.innerHTML = type === 'request'
        ? '<span class="lang-ja">依頼項目</span><span class="lang-en">Request Item</span>'
        : '<span class="lang-ja">質問</span><span class="lang-en">Question</span>';
      title.appendChild(badge);
      title.appendChild(label);
      header.appendChild(title);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-secondary';
      removeBtn.type = 'button';
      removeBtn.innerHTML = '<span class="lang-ja">削除</span><span class="lang-en">Remove</span>';
      removeBtn.addEventListener('click', () => {
        item.remove();
        updateQuestionNumbers(type);
      });
      header.appendChild(removeBtn);

      const input = document.createElement('input');
      input.type = 'text';
      input.value = presetText || '';
      input.placeholder = type === 'request'
        ? (document.body.getAttribute('data-lang') === 'ja' ? '依頼内容を入力' : 'Enter request item')
        : (document.body.getAttribute('data-lang') === 'ja' ? '質問を入力' : 'Enter question');

      const textarea = document.createElement('textarea');
      textarea.placeholder = type === 'request'
        ? (document.body.getAttribute('data-lang') === 'ja' ? '背景/狙い/条件など' : 'Background/aim/constraints')
        : (document.body.getAttribute('data-lang') === 'ja' ? '深掘りや回答メモ' : 'Follow-up & notes');

      item.appendChild(header);
      item.appendChild(input);
      item.appendChild(textarea);
      list.appendChild(item);
      updateQuestionNumbers(type);
    }

    function updateQuestionNumbers(type) {
      const listId = type === 'request' ? 'requestQuestionList' : 'directQuestionList';
      const list = document.getElementById(listId);
      if (!list) return;
      const items = list.querySelectorAll('.question-item');
      items.forEach((item, index) => {
        const badge = item.querySelector('.question-badge');
        if (badge) {
          badge.textContent = type === 'request' ? `R${index + 1}` : `Q${index + 1}`;
        }
      });
      if (type === 'direct') {
        const closingNumber = document.getElementById('closingQuestionNumber');
        if (closingNumber) {
          closingNumber.textContent = `Q${items.length + 1}`;
        }
      }
    }

    // クイックスタート
    function showQuickStart() {
      const quickStart = document.getElementById('quickStart');
      if (quickStart) {
        quickStart.style.display = 'block';
      }
    }

    function dismissQuickStart() {
      const quickStart = document.getElementById('quickStart');
      if (quickStart) {
        quickStart.style.display = 'none';
      }
      localStorage.setItem('prWorkflowFirstRun', 'false');
    }

    function updateDashboardProgress(percent, completed, total) {
      const dashboardPercent = document.getElementById('dashboardProgressPercent');
      const dashboardCompleted = document.getElementById('dashboardCompletedTasks');
      const dashboardTotal = document.getElementById('dashboardTotalTasks');
      if (dashboardPercent) dashboardPercent.textContent = percent;
      if (dashboardCompleted) dashboardCompleted.textContent = completed;
      if (dashboardTotal) dashboardTotal.textContent = total;
    }

    function setPhaseStatus(el, status) {
      if (!el) return;
      el.classList.remove('todo', 'doing', 'done');
      el.classList.add(status);
      if (status === 'todo') {
        el.innerHTML = '<span class="lang-ja">未着手</span><span class="lang-en">Not Started</span>';
      } else if (status === 'doing') {
        el.innerHTML = '<span class="lang-ja">進行中</span><span class="lang-en">In Progress</span>';
      } else {
        el.innerHTML = '<span class="lang-ja">完了</span><span class="lang-en">Completed</span>';
      }
    }

    function updateRequiredState() {
      const requiredFields = document.querySelectorAll('input[data-required="true"], textarea[data-required="true"], select[data-required="true"]');
      let remaining = 0;

      requiredFields.forEach(field => {
        const value = field.value ? field.value.trim() : '';
        const invalid = value.length === 0;
        field.classList.toggle('input-invalid', invalid);
        if (invalid) remaining += 1;
      });

      const summary = document.getElementById('requiredSummary');
      const remainingJa = document.getElementById('requiredRemaining');
      const remainingEn = document.getElementById('requiredRemainingEn');
      const dashboardRemainingJa = document.getElementById('dashboardRequiredRemaining');
      const dashboardRemainingEn = document.getElementById('dashboardRequiredRemainingEn');
      const dashboardCard = document.getElementById('dashboardRequiredCard');

      if (remainingJa) remainingJa.textContent = remaining;
      if (remainingEn) remainingEn.textContent = remaining;
      if (summary) summary.classList.toggle('ok', remaining === 0);
      if (dashboardRemainingJa) dashboardRemainingJa.textContent = remaining;
      if (dashboardRemainingEn) dashboardRemainingEn.textContent = remaining;
      if (dashboardCard) dashboardCard.classList.toggle('ok', remaining === 0);
    }

    // 進捗更新
    function updateProgress() {
      const rows = document.querySelectorAll('.workflow-row');
      const total = rows.length;
      let completed = 0;
      rows.forEach(row => {
        const status = row.querySelector('.workflow-status')?.value;
        // 状態による色分け: data-status属性を設定
        row.dataset.status = status || 'todo';
        if (status === 'done') completed += 1;
      });
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      document.getElementById('totalProgress').style.width = percent + '%';
      document.getElementById('progressPercent').textContent = percent;
      document.getElementById('completedTasks').textContent = completed;
      document.getElementById('totalTasks').textContent = total;
      updateDashboardProgress(percent, completed, total);

      // 追加機能の更新
      checkDeadlines();
      updatePhaseProgress();
      updateAssigneeWorkload();
      checkDependencies();

      // カンバン/ガントビューが表示中なら再描画
      if (typeof currentWorkflowView !== 'undefined') {
        if (currentWorkflowView === 'kanban') renderKanbanView();
        else if (currentWorkflowView === 'gantt') renderGanttView();
      }
    }

    // 期限超過チェック
    function checkDeadlines() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const soon = new Date(today);
      soon.setDate(soon.getDate() + 3); // 3日以内

      document.querySelectorAll('.workflow-row').forEach(row => {
        const status = row.querySelector('.workflow-status')?.value;
        row.classList.remove('overdue', 'due-soon');

        if (status === 'done') return;

        const dateInput = row.querySelector('.workflow-end-date');
        if (!dateInput?.value) return;

        const deadline = new Date(dateInput.value);
        deadline.setHours(0, 0, 0, 0);

        if (deadline < today) {
          row.classList.add('overdue');
        } else if (deadline <= soon) {
          row.classList.add('due-soon');
        }
      });
    }

    // フェーズ別進捗更新
    function updatePhaseProgress() {
      const container = document.getElementById('phaseProgressBars');
      if (!container) return;

      const phases = {};
      document.querySelectorAll('.workflow-row').forEach(row => {
        const phaseCell = row.querySelector('td:first-child');
        // ドラッグハンドルの後のテキストを取得
        const phaseText = phaseCell?.textContent?.replace('≡', '').trim() || '';
        const phase = phaseText || row.querySelector('td:first-child input')?.value?.trim() || '未分類';
        const status = row.querySelector('.workflow-status')?.value;

        if (!phases[phase]) phases[phase] = { total: 0, done: 0 };
        phases[phase].total++;
        if (status === 'done') phases[phase].done++;
      });

      const lang = document.body.getAttribute('data-lang') || 'ja';
      container.innerHTML = Object.entries(phases).map(([name, data]) => {
        const percent = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
        const safeName = escapeHtml(name);
        return `
          <div class="phase-bar-item">
            <span class="phase-name" title="${safeName}">${safeName}</span>
            <div class="phase-bar">
              <div class="phase-bar-fill" style="width: ${percent}%"></div>
            </div>
            <span class="phase-percent">${percent}%</span>
          </div>
        `;
      }).join('');
    }

    // 担当者別作業量更新
    function updateAssigneeWorkload() {
      const container = document.getElementById('assigneeWorkloadBody');
      if (!container) return;

      const workload = {};
      document.querySelectorAll('.workflow-row').forEach(row => {
        const assignee = row.querySelector('.workflow-assignee')?.value?.trim() || '';
        if (!assignee) return; // 未割当は除外

        const status = row.querySelector('.workflow-status')?.value || 'todo';

        if (!workload[assignee]) {
          workload[assignee] = { todo: 0, doing: 0, review: 0, back: 0, done: 0, total: 0 };
        }
        workload[assignee][status]++;
        workload[assignee].total++;
      });

      const lang = document.body.getAttribute('data-lang') || 'ja';
      const noDataMsg = lang === 'ja' ? '担当者が設定されていません' : 'No assignees set';

      if (Object.keys(workload).length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--gray-500);">${escapeHtml(noDataMsg)}</td></tr>`;
        return;
      }

      container.innerHTML = Object.entries(workload)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, data]) => `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>${data.todo}</td>
            <td>${data.doing}</td>
            <td>${data.review}</td>
            <td>${data.done}</td>
            <td><strong>${data.total}</strong></td>
          </tr>
        `).join('');
    }

    function applyWorkflowFilters() {
      const assigneeFilter = document.getElementById('workflowAssigneeFilter')?.value?.trim().toLowerCase() || '';
      const statusFilter = document.getElementById('workflowStatusFilter')?.value || '';
      document.querySelectorAll('.workflow-row').forEach(row => {
        const assignee = row.querySelector('.workflow-assignee')?.value?.trim().toLowerCase() || '';
        const status = row.querySelector('.workflow-status')?.value || '';
        const matchesAssignee = !assigneeFilter || assignee.includes(assigneeFilter);
        const matchesStatus = !statusFilter || status === statusFilter;
        row.style.display = matchesAssignee && matchesStatus ? '' : 'none';
      });
    }

    function enableWorkflowDrag() {
      const tbody = document.getElementById('workflowTableBody');
      if (!tbody) return;
      const rows = tbody.querySelectorAll('.workflow-row');
      rows.forEach(row => {
        const firstCell = row.querySelector('td');
        if (firstCell && !firstCell.querySelector('.drag-handle')) {
          const handle = document.createElement('span');
          handle.className = 'drag-handle';
          handle.title = 'Drag to reorder';
          handle.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/></svg>';
          handle.setAttribute('draggable', 'true');
          handle.addEventListener('dragstart', (e) => {
            row.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
          });
          handle.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            document.querySelectorAll('.workflow-row').forEach(r => r.classList.remove('drag-placeholder'));
          });
          firstCell.prepend(handle);
        }
      });

      if (tbody.dataset.dragReady === 'true') return;
      tbody.dataset.dragReady = 'true';
      tbody.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingRow = tbody.querySelector('.workflow-row.dragging');
        if (!draggingRow) return;
        const afterElement = getDragAfterRow(tbody, e.clientY);
        document.querySelectorAll('.workflow-row').forEach(r => r.classList.remove('drag-placeholder'));
        if (afterElement) afterElement.classList.add('drag-placeholder');
        if (afterElement == null) {
          tbody.appendChild(draggingRow);
        } else {
          tbody.insertBefore(draggingRow, afterElement);
        }
      });

      tbody.addEventListener('drop', () => {
        document.querySelectorAll('.workflow-row').forEach(r => r.classList.remove('drag-placeholder'));
      });
    }

    function getDragAfterRow(container, y) {
      const rows = [...container.querySelectorAll('.workflow-row:not(.dragging)')];
      return rows.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function addWorkflowRow() {
      const template = document.getElementById('workflowRowTemplate');
      const body = document.getElementById('workflowTableBody');
      if (!template || !body) return;
      const node = template.content.cloneNode(true);
      body.appendChild(node);

      // 新しい行のプレースホルダーを設定
      const lang = document.body.getAttribute('data-lang') || 'ja';
      const lastRow = body.lastElementChild;
      if (lastRow) {
        const textarea = lastRow.querySelector('textarea[data-placeholder-ja]');
        if (textarea) {
          textarea.placeholder = lang === 'ja' ? textarea.dataset.placeholderJa : textarea.dataset.placeholderEn;
        }
        // 担当者変更時の作業量更新
        const assigneeInput = lastRow.querySelector('.workflow-assignee');
        if (assigneeInput) {
          assigneeInput.addEventListener('change', updateAssigneeWorkload);
          assigneeInput.addEventListener('input', updateAssigneeWorkload);
        }
        // 期限変更時の警告チェック
        lastRow.querySelectorAll('.workflow-start-date, .workflow-end-date').forEach(dateInput => {
          dateInput.addEventListener('change', () => { checkDeadlines(); updateProgress(); });
        });
      }

      applyWorkflowFilters();
      enableWorkflowDrag();
      setupStatusHandlers();
      updateProgress();
    }

    function removeWorkflowRow(button) {
      const row = button.closest('.workflow-row');
      if (row) {
        row.remove();
        updateProgress();
      }
    }

    // チェックリストのトグル
    function toggleChecked(checkbox) {
      const item = checkbox.closest('.checklist-item');
      if (checkbox.checked) {
        item.classList.add('checked');
      } else {
        item.classList.remove('checked');
      }
    }

    // データ保存（LocalStorage）
    function saveData() {
      const lang = document.body.getAttribute('data-lang');
      const fields = Array.from(document.querySelectorAll('input, textarea, select'))
        .filter(el => {
          const type = (el.type || '').toLowerCase();
          return type !== 'button' && type !== 'submit' && type !== 'reset' && !el.readOnly;
        });

      const data = {
        version: 3,
        interviewType: document.querySelector('input[name="interviewType"]:checked')?.value || 'direct',
        intervieweeCount: document.querySelectorAll('.interviewee-card').length,
        directQuestionCount: document.querySelectorAll('#directQuestionList .question-item').length,
        requestQuestionCount: document.querySelectorAll('#requestQuestionList .question-item').length,
        workflowRowCount: document.querySelectorAll('.workflow-row').length,
        fields: fields.map(el => ({
          type: el.type || el.tagName.toLowerCase(),
          value: el.value,
          checked: el.checked
        }))
      };

      setStoredJson('prWorkflowData', data);
      alert(lang === 'ja' ? '保存しました' : 'Saved');
    }

    // データ読み込み
    function loadData() {
      const data = getStoredJson('prWorkflowData');
      if (data) {
        if (data.version >= 3 && Array.isArray(data.fields)) {
          if (data.interviewType) {
            const typeInput = document.querySelector(`input[name="interviewType"][value="${data.interviewType}"]`);
            if (typeInput) typeInput.checked = true;
            setInterviewType(data.interviewType);
          }

          const intervieweeList = document.getElementById('intervieweeList');
          if (intervieweeList) clearElementChildren(intervieweeList);
          const intervieweeCount = Number(data.intervieweeCount || 0);
          for (let i = 0; i < intervieweeCount; i++) {
            addInterviewee();
          }

          const directList = document.getElementById('directQuestionList');
          if (directList) clearElementChildren(directList);
          const requestList = document.getElementById('requestQuestionList');
          if (requestList) clearElementChildren(requestList);

          const directCount = Number(data.directQuestionCount || 0);
          const requestCount = Number(data.requestQuestionCount || 0);
          for (let i = 0; i < directCount; i++) {
            addQuestionItem('direct', '');
          }
          for (let i = 0; i < requestCount; i++) {
            addQuestionItem('request', '');
          }

          const workflowBody = document.getElementById('workflowTableBody');
          if (workflowBody) {
            const currentRows = workflowBody.querySelectorAll('.workflow-row').length;
            const targetRows = Number(data.workflowRowCount || currentRows);
            if (targetRows > currentRows) {
              for (let i = currentRows; i < targetRows; i++) {
                addWorkflowRow();
              }
            } else if (targetRows < currentRows) {
              const rows = Array.from(workflowBody.querySelectorAll('.workflow-row'));
              rows.slice(targetRows).forEach(row => row.remove());
            }
          }

          const fields = Array.from(document.querySelectorAll('input, textarea, select'))
            .filter(el => {
              const type = (el.type || '').toLowerCase();
              return type !== 'button' && type !== 'submit' && type !== 'reset' && !el.readOnly;
            });

          fields.forEach((el, i) => {
            const savedField = data.fields[i];
            if (!savedField) return;
            const type = (el.type || '').toLowerCase();
            if (type === 'checkbox' || type === 'radio') {
              el.checked = !!savedField.checked;
            } else {
              el.value = savedField.value ?? '';
            }
          });
        } else if (data.version === 2 && Array.isArray(data.fields)) {
          if (data.interviewType) {
            const typeInput = document.querySelector(`input[name="interviewType"][value="${data.interviewType}"]`);
            if (typeInput) typeInput.checked = true;
            setInterviewType(data.interviewType);
          }

          const intervieweeList = document.getElementById('intervieweeList');
          if (intervieweeList) clearElementChildren(intervieweeList);
          const intervieweeCount = Number(data.intervieweeCount || 0);
          for (let i = 0; i < intervieweeCount; i++) {
            addInterviewee();
          }

          const directList = document.getElementById('directQuestionList');
          if (directList) clearElementChildren(directList);
          const requestList = document.getElementById('requestQuestionList');
          if (requestList) clearElementChildren(requestList);

          const directCount = Number(data.directQuestionCount || 0);
          const requestCount = Number(data.requestQuestionCount || 0);
          for (let i = 0; i < directCount; i++) {
            addQuestionItem('direct', '');
          }
          for (let i = 0; i < requestCount; i++) {
            addQuestionItem('request', '');
          }

          const fields = Array.from(document.querySelectorAll('input, textarea, select'))
            .filter(el => {
              const type = (el.type || '').toLowerCase();
              return type !== 'button' && type !== 'submit' && type !== 'reset' && !el.readOnly;
            });

          fields.forEach((el, i) => {
            const savedField = data.fields[i];
            if (!savedField) return;
            const type = (el.type || '').toLowerCase();
            if (type === 'checkbox' || type === 'radio') {
              el.checked = !!savedField.checked;
            } else {
              el.value = savedField.value ?? '';
            }
          });
        } else {
          if (data.projectName) document.getElementById('projectName').value = data.projectName;
          if (data.publishDate) document.getElementById('publishDate').value = data.publishDate;
          if (data.purpose) document.getElementById('purpose').value = data.purpose;
          if (data.targetAudience) document.getElementById('targetAudience').value = data.targetAudience;
          if (data.coreMessage) document.getElementById('coreMessage').value = data.coreMessage;
          if (data.person) document.getElementById('person').value = data.person;
          if (data.approver) document.getElementById('approver').value = data.approver;

          if (data.tasks) {
            document.querySelectorAll('.task-item input[type="checkbox"]').forEach((cb, i) => {
              if (data.tasks[i]) {
                cb.checked = true;
              }
            });
          }

          if (data.checklists) {
            document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach((cb, i) => {
              if (data.checklists[i]) {
                cb.checked = true;
                cb.closest('.checklist-item').classList.add('checked');
              }
            });
          }
        }

        document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach((cb) => {
          if (cb.checked) cb.closest('.checklist-item').classList.add('checked');
        });

        updateProgress();
        updateRequiredState();
        updateQuestionNumbers('direct');
        updateQuestionNumbers('request');
      }
    }

    // データエクスポート
    function exportData() {
      const data = getStoredJson('prWorkflowData');
      if (data) {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pr-workflow-data.json';
        a.click();
      }
    }

    function exportCsv() {
      const data = getStoredJson('prWorkflowData');
      if (!data) return;
      const parsed = data;

      const rows = [];
      rows.push(['section', 'label', 'value'].join(','));

      const fields = Array.from(document.querySelectorAll('input, textarea, select'))
        .filter(el => {
          const type = (el.type || '').toLowerCase();
          return type !== 'button' && type !== 'submit' && type !== 'reset' && !el.readOnly;
        });

      fields.forEach((el, i) => {
        const label = el.closest('.form-group')?.querySelector('label')?.innerText?.replace(/\s+/g, ' ') || el.name || el.id || `field_${i}`;
        let value = '';
        const type = (el.type || '').toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
          value = el.checked ? 'true' : 'false';
        } else {
          value = el.value || '';
        }
        const section = el.closest('.panel')?.id || 'global';
        rows.push([section, escapeCsv(label), escapeCsv(value)].join(','));
      });

      if (parsed?.interviewType) {
        rows.push(['meta', 'interviewType', escapeCsv(parsed.interviewType)].join(','));
      }

      const csv = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pr-workflow-data.csv';
      a.click();
    }

    function escapeCsv(value) {
      const v = String(value ?? '');
      if (v.includes('"') || v.includes(',') || v.includes('\n')) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }

    function clearData() {
      const lang = document.body.getAttribute('data-lang');
      const ok = confirm(lang === 'ja' ? '保存データを消去します。よろしいですか？' : 'Clear saved data. Continue?');
      if (!ok) return;
      localStorage.removeItem('prWorkflowData');
      localStorage.removeItem('prWorkflowChangeLog');
      location.reload();
    }

    // ========================================
    // タスクガイダンスデータ（40タスク分）
    // ========================================
    const TASK_GUIDANCE = {
      // === 企画・構成フェーズ ===
      '目的/ゴールの明確化': {
        description: '広報物を作成する目的と達成したいゴールを明文化します。「なぜこの広報物が必要か」を関係者全員が共有できる状態を目指します。',
        deliverable: '目的・ゴール記述書（A4 1枚程度）',
        tips: ['「誰に」「何を」「どうしてほしいか」の3点を必ず含める', '数値目標があれば明記（問い合わせ数、認知度等）', '上長や決裁者の承認を得ておくとスムーズ'],
        checkpoints: ['目的が1文で説明できるか', 'ターゲットに到達可能な手段か', '予算・期間内で実現可能か'],
        dependencies: []
      },
      'ターゲット/ペルソナ設定': {
        description: '想定読者の属性・課題・ニーズを具体的な人物像として定義します。',
        deliverable: 'ペルソナシート（1-3人分）',
        tips: ['実在の知人をモデルにすると具体化しやすい', '「この人が読んだらどう感じるか」を常に意識', '複数ペルソナがある場合は優先順位を付ける'],
        checkpoints: ['年齢・職業・役職が明確か', '抱えている課題や悩みが特定できているか', '情報収集の方法が分かっているか'],
        dependencies: ['目的/ゴールの明確化']
      },
      '競合/類似物調査': {
        description: '競合他社や類似の広報物を収集・分析し、差別化ポイントを見つけます。',
        deliverable: '競合調査レポート（比較表含む）',
        tips: ['3-5件程度の類似物を集める', '良い点・改善点を両方メモする', 'デザイン、メッセージ、構成をチェック'],
        checkpoints: ['主要な競合を網羅しているか', '差別化ポイントが明確になったか'],
        dependencies: ['目的/ゴールの明確化']
      },
      'コアメッセージ決定': {
        description: '広報物全体を貫く核となるメッセージを決定します。',
        deliverable: 'コアメッセージ文（1-2文）',
        tips: ['読者が一番覚えてほしいことを1文で', 'ベネフィット（読者の利益）を入れる', '競合と差別化できる表現を選ぶ'],
        checkpoints: ['読者目線で魅力的か', '簡潔で覚えやすいか', '全体の方向性を示せているか'],
        dependencies: ['ターゲット/ペルソナ設定', '競合/類似物調査']
      },
      '構成案/台割作成': {
        description: 'ページ構成と各ページの役割を決めます。',
        deliverable: '台割表（ページ割り付け表）',
        tips: ['読者の関心の流れに沿って配置', '重要な情報は前半に', '見開き単位で考える'],
        checkpoints: ['情報の過不足がないか', '読者が迷わない流れになっているか', 'ページ数は適切か'],
        dependencies: ['コアメッセージ決定']
      },
      'スケジュール/予算確定': {
        description: '制作から納品までのスケジュールと予算を確定します。',
        deliverable: 'スケジュール表、予算書',
        tips: ['校正や修正の時間を十分に確保', '外注費用は見積もりを取る', '印刷部数と単価を確認'],
        checkpoints: ['各工程の担当者が決まっているか', '締め切りに余裕があるか', '予算内に収まるか'],
        dependencies: ['構成案/台割作成']
      },
      '企画承認': {
        description: '企画内容について関係者の承認を得ます。',
        deliverable: '承認済み企画書',
        tips: ['決裁者には事前に相談しておく', '懸念点は先に対策を用意', '承認履歴を記録しておく'],
        checkpoints: ['必要な決裁者全員の承認を得たか', '修正指示は明確に記録したか'],
        dependencies: ['目的/ゴールの明確化', 'スケジュール/予算確定']
      },
      // === 取材・素材フェーズ ===
      '取材対象者リスト作成': {
        description: '取材が必要な人物をリストアップし、優先順位を付けます。',
        deliverable: '取材対象者リスト（連絡先、役割含む）',
        tips: ['キーパーソンを特定する', '代替候補も用意しておく', '取材の目的と聞きたいことを整理'],
        checkpoints: ['必要な取材対象を網羅しているか', '連絡先は確認できているか'],
        dependencies: ['構成案/台割作成']
      },
      '取材質問設計': {
        description: '取材で聞く質問を事前に設計します。',
        deliverable: '質問リスト',
        tips: ['オープンクエスチョンを中心に', '「なぜ」「どのように」を多用', '想定回答に対する深掘り質問も用意'],
        checkpoints: ['広報物に必要な情報を引き出せる質問か', '時間内に収まる量か'],
        dependencies: ['取材対象者リスト作成']
      },
      '取材アポイント調整': {
        description: '取材対象者との日程・場所を調整します。',
        deliverable: '取材スケジュール表',
        tips: ['候補日は複数提示', '所要時間を明確に伝える', '取材目的と使用用途を説明'],
        checkpoints: ['全員の日程が確定したか', '場所・機材の手配は済んでいるか'],
        dependencies: ['取材質問設計']
      },
      '取材実施/記録': {
        description: '取材を実施し、内容を記録します。',
        deliverable: '取材記録（録音データ、メモ）',
        tips: ['録音許可を必ず取る', '表情や雰囲気もメモ', '写真撮影の許可も確認'],
        checkpoints: ['必要な情報は聞けたか', '記録は正確に残せているか'],
        dependencies: ['取材アポイント調整']
      },
      '文字起こし/記録整理': {
        description: '取材内容を文字に起こし、整理します。',
        deliverable: '取材記録文書',
        tips: ['重要な発言にはマーキング', '使えそうな引用をピックアップ', '不明点は早めに確認'],
        checkpoints: ['引用として使える発言を抽出したか', '事実確認が必要な箇所を特定したか'],
        dependencies: ['取材実施/記録']
      },
      '写真/素材撮影・収集': {
        description: '広報物に使用する写真や素材を撮影・収集します。',
        deliverable: '写真データ、素材ファイル',
        tips: ['複数アングルで撮影', '高解像度で保存', '使用許諾を確認'],
        checkpoints: ['必要なカットは揃っているか', '画質は印刷に耐えるか', '肖像権・著作権は確認したか'],
        dependencies: ['構成案/台割作成']
      },
      '素材の不足確認/追加入手': {
        description: '不足している素材を特定し、追加で入手します。',
        deliverable: '追加素材',
        tips: ['台割と照らし合わせてチェック', '代替案も検討', '入手に時間がかかるものは早めに'],
        checkpoints: ['全ての素材が揃ったか', '品質は十分か'],
        dependencies: ['写真/素材撮影・収集', '文字起こし/記録整理']
      },
      // === 原稿作成フェーズ ===
      '初稿執筆': {
        description: '取材内容と構成案をもとに原稿の初稿を執筆します。',
        deliverable: '原稿初稿',
        tips: ['まずは書き切ることを優先', '読者目線を意識', 'コアメッセージを繰り返し確認'],
        checkpoints: ['コアメッセージが伝わる内容か', '文字数は適切か', '事実に誤りがないか'],
        dependencies: ['構成案/台割作成', '文字起こし/記録整理']
      },
      'キャッチ/見出し案作成': {
        description: 'キャッチコピーや見出しの案を複数作成します。',
        deliverable: 'キャッチコピー案、見出し案（各3-5案）',
        tips: ['読者の興味を引く表現を', '数字や具体性を入れる', '短く印象的に'],
        checkpoints: ['目を引く表現になっているか', '内容と一致しているか', '競合と差別化できているか'],
        dependencies: ['初稿執筆']
      },
      '内部レビュー（文章）': {
        description: '原稿を関係者に回覧し、フィードバックを収集します。',
        deliverable: 'レビューコメント一覧',
        tips: ['レビュー観点を明示して依頼', '締め切りを設定', '矛盾する意見は調整が必要'],
        checkpoints: ['必要な関係者全員からフィードバックを得たか', '修正方針は明確か'],
        dependencies: ['初稿執筆', 'キャッチ/見出し案作成']
      },
      '修正/第2稿作成': {
        description: 'レビューを踏まえて原稿を修正します。',
        deliverable: '原稿第2稿',
        tips: ['指摘事項を一覧化してから着手', '修正箇所を明示', '新たな問題を生まないよう注意'],
        checkpoints: ['指摘事項は全て対応したか', '修正により文脈が崩れていないか'],
        dependencies: ['内部レビュー（文章）']
      },
      '対象者/関係者確認': {
        description: '取材対象者や関係者に原稿内容を確認してもらいます。',
        deliverable: '確認済み原稿',
        tips: ['確認期限を明示', '修正可能な範囲を伝える', '確認履歴を記録'],
        checkpoints: ['発言内容に誤りがないか', '公開して問題ない内容か'],
        dependencies: ['修正/第2稿作成']
      },
      '原稿確定': {
        description: '原稿の最終版を確定します。',
        deliverable: '確定原稿',
        tips: ['これ以降の修正は最小限に', '確定日を記録', 'バージョン管理を徹底'],
        checkpoints: ['必要な承認を全て得たか', '誤字脱字の最終チェックは済んだか'],
        dependencies: ['対象者/関係者確認']
      },
      // === 編集・組版フェーズ ===
      'デザインコンセプト決定': {
        description: '広報物全体のデザインの方向性を決定します。',
        deliverable: 'デザインコンセプトシート、ムードボード',
        tips: ['ターゲットの好みを考慮', '競合との差別化を意識', '参考イメージを集める'],
        checkpoints: ['コアメッセージと一致しているか', '実現可能なデザインか'],
        dependencies: ['コアメッセージ決定', '構成案/台割作成']
      },
      'ラフレイアウト作成': {
        description: '各ページの大まかなレイアウトを作成します。',
        deliverable: 'ラフレイアウト',
        tips: ['手書きでも可', '要素の優先順位を意識', '余白を十分に取る'],
        checkpoints: ['情報の階層が明確か', '視線の流れは自然か'],
        dependencies: ['デザインコンセプト決定']
      },
      '写真/図版選定・配置': {
        description: '使用する写真や図版を選定し、配置を決めます。',
        deliverable: '写真・図版配置案',
        tips: ['高品質なものを選ぶ', '統一感を意識', 'キャプションの要否を確認'],
        checkpoints: ['全ての素材が揃っているか', '配置は適切か'],
        dependencies: ['ラフレイアウト作成', '素材の不足確認/追加入手']
      },
      '初稿組版作成': {
        description: 'デザインソフトで実際の組版を作成します。',
        deliverable: '組版初稿（PDF等）',
        tips: ['文字サイズ・行間を適切に', '印刷を想定した色設定', '校正用にPDF出力'],
        checkpoints: ['文字は読みやすいか', '写真の解像度は十分か', 'はみ出し等はないか'],
        dependencies: ['原稿確定', '写真/図版選定・配置']
      },
      '内部レビュー（デザイン）': {
        description: 'デザインを関係者に確認してもらいます。',
        deliverable: 'デザインレビューコメント',
        tips: ['画面と印刷で見え方が違うことを考慮', '複数の目でチェック', '優先度を付けてフィードバック'],
        checkpoints: ['デザインコンセプトに沿っているか', '読みやすさは確保できているか'],
        dependencies: ['初稿組版作成']
      },
      'デザイン修正': {
        description: 'レビューを踏まえてデザインを修正します。',
        deliverable: '修正版デザイン',
        tips: ['修正履歴を残す', '大きな変更は再確認を', '細部まで丁寧に'],
        checkpoints: ['指摘事項は全て対応したか', '新たな問題は生じていないか'],
        dependencies: ['内部レビュー（デザイン）']
      },
      'デザイン確定': {
        description: 'デザインの最終版を確定します。',
        deliverable: '確定デザイン',
        tips: ['確定後の修正は避ける', '印刷用データの形式を確認', 'バックアップを取る'],
        checkpoints: ['必要な承認を得たか', '印刷仕様に合っているか'],
        dependencies: ['デザイン修正']
      },
      // === 校正フェーズ ===
      '初校チェック': {
        description: '組版の初校を校正します。',
        deliverable: '初校ゲラ（赤字入り）',
        tips: ['誤字脱字を重点的に', '事実関係も再確認', '複数人でチェック'],
        checkpoints: ['誤字脱字はないか', '数字・固有名詞は正確か', 'レイアウト崩れはないか'],
        dependencies: ['デザイン確定']
      },
      '初校赤字反映': {
        description: '初校の校正結果を反映します。',
        deliverable: '修正版組版',
        tips: ['赤字を一つずつ確認しながら反映', '反映漏れに注意', '修正前後を比較'],
        checkpoints: ['全ての赤字を反映したか', '新たなミスを生んでいないか'],
        dependencies: ['初校チェック']
      },
      '再校チェック': {
        description: '修正後の再校を確認します。',
        deliverable: '再校ゲラ（赤字入り）',
        tips: ['初校の修正箇所を重点確認', '全体の整合性もチェック', '読者目線で通読'],
        checkpoints: ['初校の指摘は正しく反映されているか', '新たな問題はないか'],
        dependencies: ['初校赤字反映']
      },
      '再校赤字反映': {
        description: '再校の校正結果を反映します。',
        deliverable: '修正版組版',
        tips: ['慎重に反映', '必要に応じて三校へ'],
        checkpoints: ['全ての赤字を反映したか', '修正による副作用はないか'],
        dependencies: ['再校チェック']
      },
      '三校チェック': {
        description: '最終確認として三校をチェックします。',
        deliverable: '三校ゲラ（赤字入り）',
        tips: ['最終チェックの意識で', '細部まで確認', '印刷に出しても問題ないか判断'],
        checkpoints: ['完成度は十分か', '見落としはないか'],
        dependencies: ['再校赤字反映']
      },
      '三校赤字反映': {
        description: '三校の校正結果を反映します。',
        deliverable: '最終版組版',
        tips: ['最小限の修正に留める', '修正後は再度確認'],
        checkpoints: ['校了できる状態か'],
        dependencies: ['三校チェック']
      },
      // === 色校正フェーズ ===
      '色校正出し/確認': {
        description: '印刷機で出力した色校正を確認します。',
        deliverable: '色校正紙',
        tips: ['自然光で確認', '画面との違いをチェック', '重要な写真は特に注意'],
        checkpoints: ['色味は意図通りか', '印刷品質は問題ないか'],
        dependencies: ['三校赤字反映']
      },
      '色校正戻し/確定': {
        description: '色校正の結果を印刷会社に戻し、確定します。',
        deliverable: '色校正戻し指示書',
        tips: ['修正箇所は具体的に指示', '許容範囲を明示', '最終確認の意識で'],
        checkpoints: ['印刷に進んで問題ないか', '修正指示は明確か'],
        dependencies: ['色校正出し/確認']
      },
      // === 入稿・公開フェーズ ===
      '入稿データ作成': {
        description: '印刷会社に渡す入稿データを作成します。',
        deliverable: '入稿データ一式',
        tips: ['印刷会社の仕様を確認', 'フォントの埋め込み', '画像のリンク切れ注意'],
        checkpoints: ['データに不備はないか', '仕様通りに作成されているか'],
        dependencies: ['色校正戻し/確定']
      },
      '印刷発注/公開準備': {
        description: '印刷を発注、またはWeb公開の準備をします。',
        deliverable: '発注書、公開準備完了報告',
        tips: ['納期・部数を再確認', '納品場所を手配', '公開日時を関係者に周知'],
        checkpoints: ['発注内容は正確か', '受け取り体制は整っているか'],
        dependencies: ['入稿データ作成']
      },
      '校了/最終承認': {
        description: '制作物の最終承認を行い、校了とします。',
        deliverable: '校了承認書',
        tips: ['責任者の最終確認', '校了後の修正は原則不可', '校了日を記録'],
        checkpoints: ['全ての承認者から了承を得たか', '公開して問題ないか'],
        dependencies: ['印刷発注/公開準備']
      },
      '納品/公開': {
        description: '完成した広報物を納品、または公開します。',
        deliverable: '納品物、公開完了報告',
        tips: ['納品物の検品', '公開後の動作確認', '関係者への報告'],
        checkpoints: ['納品物に問題はないか', '公開は正しく行われたか'],
        dependencies: ['校了/最終承認']
      },
      '配布/告知': {
        description: '広報物を配布し、関係者に告知します。',
        deliverable: '配布完了報告',
        tips: ['配布先リストを作成', '配布方法を確認', 'SNS等での告知も検討'],
        checkpoints: ['予定通り配布できたか', '反響を記録しているか'],
        dependencies: ['納品/公開']
      },
      '振り返り/ナレッジ整理': {
        description: 'プロジェクト全体を振り返り、学びを整理します。',
        deliverable: '振り返りレポート',
        tips: ['良かった点・改善点を両方', '次回に活かせる形で記録', 'チームで共有'],
        checkpoints: ['反省点は明確か', '次回のアクションは決まったか'],
        dependencies: ['配布/告知']
      }
    };

    // 英語版タスクガイダンス
    const TASK_GUIDANCE_EN = {
      '目的/ゴールの明確化': {
        description: 'Document the purpose and goals of creating the PR materials. Aim for a state where all stakeholders share understanding of "why this material is needed."',
        deliverable: 'Purpose & Goal Statement (about 1 page)',
        tips: ['Include "who," "what," and "desired action"', 'Specify numerical targets if applicable (inquiries, awareness, etc.)', 'Get approval from supervisors early'],
        checkpoints: ['Can the purpose be explained in one sentence?', 'Is the target audience reachable?', 'Is it achievable within budget and timeline?']
      },
      'ターゲット/ペルソナ設定': {
        description: 'Define the target reader\'s attributes, challenges, and needs as a concrete persona.',
        deliverable: 'Persona Sheet (1-3 personas)',
        tips: ['Use real acquaintances as models for specificity', 'Always consider "how would this person feel reading this?"', 'Prioritize if multiple personas exist'],
        checkpoints: ['Are age, occupation, and position clear?', 'Are their challenges identified?', 'Do you know how they gather information?']
      },
      '競合/類似物調査': {
        description: 'Collect and analyze competitor or similar materials to find differentiation points.',
        deliverable: 'Competitor Research Report (with comparison table)',
        tips: ['Collect 3-5 similar materials', 'Note both strengths and areas for improvement', 'Check design, message, and structure'],
        checkpoints: ['Have major competitors been covered?', 'Are differentiation points clear?']
      },
      'コアメッセージ決定': {
        description: 'Determine the core message that runs through the entire PR material.',
        deliverable: 'Core Message Statement (1-2 sentences)',
        tips: ['Summarize what readers should remember most in one sentence', 'Include benefits for the reader', 'Choose expressions that differentiate from competitors'],
        checkpoints: ['Is it attractive from the reader\'s perspective?', 'Is it concise and memorable?', 'Does it indicate the overall direction?']
      },
      '構成案/台割作成': {
        description: 'Determine page structure and the role of each page.',
        deliverable: 'Layout Plan (page allocation table)',
        tips: ['Arrange according to reader interest flow', 'Place important information early', 'Think in spreads'],
        checkpoints: ['Is there neither too much nor too little information?', 'Is the flow easy to follow?', 'Is the page count appropriate?']
      },
      'スケジュール/予算確定': {
        description: 'Finalize the schedule from production to delivery and the budget.',
        deliverable: 'Schedule, Budget Document',
        tips: ['Allow sufficient time for proofreading and revisions', 'Get quotes for outsourcing costs', 'Confirm print quantity and unit price'],
        checkpoints: ['Are persons in charge assigned for each phase?', 'Is there buffer in deadlines?', 'Is it within budget?']
      },
      '企画承認': {
        description: 'Obtain approval from stakeholders on the plan.',
        deliverable: 'Approved Planning Document',
        tips: ['Consult with decision-makers beforehand', 'Prepare countermeasures for concerns', 'Record approval history'],
        checkpoints: ['Have all necessary approvers signed off?', 'Are revision instructions clearly recorded?']
      },
      '取材対象者リスト作成': {
        description: 'List people who need to be interviewed and prioritize them.',
        deliverable: 'Interviewee List (with contact info and roles)',
        tips: ['Identify key persons', 'Prepare alternatives', 'Organize interview purposes and questions'],
        checkpoints: ['Are all necessary interviewees covered?', 'Is contact information confirmed?']
      },
      '取材質問設計': {
        description: 'Design interview questions in advance.',
        deliverable: 'Question List',
        tips: ['Focus on open-ended questions', 'Use "why" and "how" frequently', 'Prepare follow-up questions for expected answers'],
        checkpoints: ['Can the questions extract information needed for the PR material?', 'Will it fit within the time?']
      },
      '取材アポイント調整': {
        description: 'Coordinate dates and locations with interviewees.',
        deliverable: 'Interview Schedule',
        tips: ['Offer multiple date options', 'Clearly communicate duration', 'Explain purpose and usage'],
        checkpoints: ['Are all schedules confirmed?', 'Are venue and equipment arranged?']
      },
      '取材実施/記録': {
        description: 'Conduct interviews and record the content.',
        deliverable: 'Interview Records (audio, notes)',
        tips: ['Always get recording permission', 'Note facial expressions and atmosphere too', 'Confirm photo permission'],
        checkpoints: ['Was necessary information obtained?', 'Are records accurate?']
      },
      '文字起こし/記録整理': {
        description: 'Transcribe and organize interview content.',
        deliverable: 'Interview Transcript Document',
        tips: ['Mark important statements', 'Pick out usable quotes', 'Clarify unclear points early'],
        checkpoints: ['Have usable quotes been extracted?', 'Have items needing fact-checking been identified?']
      },
      '写真/素材撮影・収集': {
        description: 'Shoot or collect photos and materials for the PR piece.',
        deliverable: 'Photo Data, Material Files',
        tips: ['Shoot from multiple angles', 'Save in high resolution', 'Confirm usage permissions'],
        checkpoints: ['Are all needed shots ready?', 'Is quality sufficient for printing?', 'Are portrait/copyright rights confirmed?']
      },
      '素材の不足確認/追加入手': {
        description: 'Identify missing materials and obtain them additionally.',
        deliverable: 'Additional Materials',
        tips: ['Check against the layout plan', 'Consider alternatives', 'Start early for time-consuming items'],
        checkpoints: ['Are all materials complete?', 'Is quality sufficient?']
      },
      '初稿執筆': {
        description: 'Write the first draft based on interview content and structure.',
        deliverable: 'First Draft',
        tips: ['Prioritize completing the draft first', 'Be conscious of the reader\'s perspective', 'Keep referring to the core message'],
        checkpoints: ['Does it convey the core message?', 'Is the word count appropriate?', 'Are facts accurate?']
      },
      'キャッチ/見出し案作成': {
        description: 'Create multiple catchphrase and headline options.',
        deliverable: 'Catchphrases, Headlines (3-5 options each)',
        tips: ['Use expressions that grab reader interest', 'Include numbers and specifics', 'Keep short and impactful'],
        checkpoints: ['Are they eye-catching?', 'Do they match the content?', 'Do they differentiate from competitors?']
      },
      '内部レビュー（文章）': {
        description: 'Circulate the draft to stakeholders and collect feedback.',
        deliverable: 'Review Comments List',
        tips: ['Specify review criteria when requesting', 'Set deadlines', 'Conflicting opinions need coordination'],
        checkpoints: ['Has feedback been received from all necessary stakeholders?', 'Is the revision policy clear?']
      },
      '修正/第2稿作成': {
        description: 'Revise the draft based on reviews.',
        deliverable: 'Second Draft',
        tips: ['List all feedback items before starting', 'Highlight revised sections', 'Be careful not to create new problems'],
        checkpoints: ['Have all feedback items been addressed?', 'Has the revision not disrupted context?']
      },
      '対象者/関係者確認': {
        description: 'Have interviewees and stakeholders verify the draft content.',
        deliverable: 'Verified Draft',
        tips: ['Specify confirmation deadline', 'Communicate scope of possible revisions', 'Record confirmation history'],
        checkpoints: ['Are statements accurate?', 'Is the content suitable for publication?']
      },
      '原稿確定': {
        description: 'Finalize the final version of the manuscript.',
        deliverable: 'Finalized Manuscript',
        tips: ['Keep revisions minimal after this', 'Record the finalization date', 'Maintain thorough version control'],
        checkpoints: ['Have all necessary approvals been obtained?', 'Has final typo check been done?']
      },
      'デザインコンセプト決定': {
        description: 'Determine the overall design direction of the PR material.',
        deliverable: 'Design Concept Sheet, Mood Board',
        tips: ['Consider target preferences', 'Be conscious of differentiation from competitors', 'Collect reference images'],
        checkpoints: ['Does it align with the core message?', 'Is the design achievable?']
      },
      'ラフレイアウト作成': {
        description: 'Create rough layouts for each page.',
        deliverable: 'Rough Layout',
        tips: ['Hand-drawn is acceptable', 'Be conscious of element priority', 'Leave sufficient white space'],
        checkpoints: ['Is information hierarchy clear?', 'Is the visual flow natural?']
      },
      '写真/図版選定・配置': {
        description: 'Select photos and illustrations and determine placement.',
        deliverable: 'Photo/Illustration Placement Plan',
        tips: ['Choose high-quality ones', 'Be conscious of consistency', 'Confirm if captions are needed'],
        checkpoints: ['Are all materials ready?', 'Is placement appropriate?']
      },
      '初稿組版作成': {
        description: 'Create actual typesetting using design software.',
        deliverable: 'First Typeset Draft (PDF, etc.)',
        tips: ['Set appropriate font size and line spacing', 'Use print-ready color settings', 'Export PDF for proofreading'],
        checkpoints: ['Is text readable?', 'Is image resolution sufficient?', 'Is there any overflow?']
      },
      '内部レビュー（デザイン）': {
        description: 'Have stakeholders review the design.',
        deliverable: 'Design Review Comments',
        tips: ['Consider that screen and print look different', 'Have multiple people check', 'Prioritize feedback'],
        checkpoints: ['Does it follow the design concept?', 'Is readability ensured?']
      },
      'デザイン修正': {
        description: 'Revise design based on review.',
        deliverable: 'Revised Design',
        tips: ['Keep revision history', 'Re-confirm for major changes', 'Be thorough with details'],
        checkpoints: ['Have all feedback items been addressed?', 'Have no new problems arisen?']
      },
      'デザイン確定': {
        description: 'Finalize the final design version.',
        deliverable: 'Finalized Design',
        tips: ['Avoid revisions after finalization', 'Confirm print data format', 'Take backups'],
        checkpoints: ['Have necessary approvals been obtained?', 'Does it meet print specifications?']
      },
      '初校チェック': {
        description: 'Proofread the first typeset proof.',
        deliverable: 'First Proof with Corrections',
        tips: ['Focus on typos', 'Re-verify facts', 'Have multiple people check'],
        checkpoints: ['Are there no typos?', 'Are numbers and proper nouns accurate?', 'Is there no layout collapse?']
      },
      '初校赤字反映': {
        description: 'Apply first proof corrections.',
        deliverable: 'Revised Typeset',
        tips: ['Verify each correction as you apply', 'Be careful not to miss any', 'Compare before and after'],
        checkpoints: ['Have all corrections been applied?', 'Have no new mistakes been introduced?']
      },
      '再校チェック': {
        description: 'Check the revised second proof.',
        deliverable: 'Second Proof with Corrections',
        tips: ['Focus on checking first proof corrections', 'Also check overall consistency', 'Read through from reader\'s perspective'],
        checkpoints: ['Were first proof corrections properly applied?', 'Are there no new issues?']
      },
      '再校赤字反映': {
        description: 'Apply second proof corrections.',
        deliverable: 'Revised Typeset',
        tips: ['Apply carefully', 'Proceed to third proof if needed'],
        checkpoints: ['Have all corrections been applied?', 'Are there no side effects from revisions?']
      },
      '三校チェック': {
        description: 'Check third proof as final verification.',
        deliverable: 'Third Proof with Corrections',
        tips: ['Approach as final check', 'Verify details', 'Judge if ready for printing'],
        checkpoints: ['Is completion level sufficient?', 'Is anything overlooked?']
      },
      '三校赤字反映': {
        description: 'Apply third proof corrections.',
        deliverable: 'Final Typeset',
        tips: ['Keep revisions minimal', 'Re-verify after revisions'],
        checkpoints: ['Is it ready for final approval?']
      },
      '色校正出し/確認': {
        description: 'Check color proof output from the printing press.',
        deliverable: 'Color Proof',
        tips: ['Check under natural light', 'Compare with screen', 'Pay special attention to important photos'],
        checkpoints: ['Are colors as intended?', 'Is print quality acceptable?']
      },
      '色校正戻し/確定': {
        description: 'Return color proof feedback to printer and finalize.',
        deliverable: 'Color Proof Return Instructions',
        tips: ['Give specific revision instructions', 'Specify tolerance range', 'Approach as final confirmation'],
        checkpoints: ['Is it ready to proceed to printing?', 'Are revision instructions clear?']
      },
      '入稿データ作成': {
        description: 'Prepare submission data for the printer.',
        deliverable: 'Submission Data Package',
        tips: ['Confirm printer specifications', 'Embed fonts', 'Watch for broken image links'],
        checkpoints: ['Is data error-free?', 'Is it created according to specifications?']
      },
      '印刷発注/公開準備': {
        description: 'Place print order or prepare for web publication.',
        deliverable: 'Order Form, Publication Readiness Report',
        tips: ['Re-confirm deadline and quantity', 'Arrange delivery location', 'Inform stakeholders of publication date'],
        checkpoints: ['Is order content accurate?', 'Is receiving arrangement ready?']
      },
      '校了/最終承認': {
        description: 'Give final approval and sign off on the deliverable.',
        deliverable: 'Final Approval Document',
        tips: ['Final check by responsible person', 'No revisions in principle after approval', 'Record approval date'],
        checkpoints: ['Have all approvers given consent?', 'Is it suitable for publication?']
      },
      '納品/公開': {
        description: 'Deliver or publish the completed PR material.',
        deliverable: 'Deliverables, Publication Completion Report',
        tips: ['Inspect deliverables', 'Verify post-publication functionality', 'Report to stakeholders'],
        checkpoints: ['Are deliverables problem-free?', 'Was publication done correctly?']
      },
      '配布/告知': {
        description: 'Distribute PR materials and notify stakeholders.',
        deliverable: 'Distribution Completion Report',
        tips: ['Create distribution list', 'Confirm distribution method', 'Consider SNS announcements'],
        checkpoints: ['Was distribution completed as planned?', 'Is feedback being recorded?']
      },
      '振り返り/ナレッジ整理': {
        description: 'Reflect on the entire project and organize learnings.',
        deliverable: 'Retrospective Report',
        tips: ['Include both positives and areas for improvement', 'Record in a form useful for next time', 'Share with team'],
        checkpoints: ['Are reflection points clear?', 'Are next actions decided?']
      }
    };

    // 依存関係データ
    const TASK_DEPENDENCIES = {};
    Object.entries(TASK_GUIDANCE).forEach(([taskName, data]) => {
      if (data.dependencies && data.dependencies.length > 0) {
        TASK_DEPENDENCIES[taskName] = data.dependencies;
      }
    });

    // タスクセルから純粋なタスク名（日本語）を取得するヘルパー
    function getTaskNameJa(taskCell) {
      // data-text-ja があればそちらを使用（最も信頼性が高い）
      if (taskCell.dataset.textJa) return taskCell.dataset.textJa;
      // なければボタン・警告を除いたテキストを取得
      const clone = taskCell.cloneNode(true);
      clone.querySelectorAll('.task-info-btn, .dependency-warning').forEach(el => el.remove());
      return clone.textContent.trim();
    }

    // 依存関係チェック
    function checkDependencies() {
      const lang = document.body.getAttribute('data-lang') || 'ja';
      document.querySelectorAll('.workflow-row').forEach(row => {
        const taskCell = row.querySelector('td:nth-child(2)');
        if (!taskCell) return;

        const taskNameJa = getTaskNameJa(taskCell);
        const deps = TASK_DEPENDENCIES[taskNameJa];
        const existingWarning = taskCell.querySelector('.dependency-warning');
        if (existingWarning) existingWarning.remove();

        if (!deps || deps.length === 0) return;

        const status = row.querySelector('.workflow-status')?.value;
        if (status === 'done') return; // 完了済みは警告不要

        const blockers = deps.filter(depName => {
          const depRow = findRowByTaskName(depName);
          return depRow && depRow.querySelector('.workflow-status')?.value !== 'done';
        });

        if (blockers.length > 0) {
          // 表示用のブロッカー名（英語モード時は翻訳）
          const displayBlockers = blockers.map(name =>
            lang === 'en' ? (workflowTranslations.tasks[name] || name) : name
          );
          const warning = document.createElement('span');
          warning.className = 'dependency-warning';
          warning.textContent = lang === 'ja'
            ? `⚠ 先行タスク未完了: ${displayBlockers.join(', ')}`
            : `⚠ Blocked by: ${displayBlockers.join(', ')}`;
          taskCell.appendChild(warning);
        }
      });
    }

    function findRowByTaskName(taskNameJa) {
      const rows = document.querySelectorAll('.workflow-row');
      for (const row of rows) {
        const cell = row.querySelector('td:nth-child(2)');
        if (cell && getTaskNameJa(cell) === taskNameJa) {
          return row;
        }
      }
      return null;
    }

    // モーダル表示
    function showModal(title, content) {
      const modal = document.getElementById('guidanceModal');
      if (!modal) return;
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalBody').innerHTML = content;
      modal.classList.remove('hidden');
    }

    function closeModal() {
      const modal = document.getElementById('guidanceModal');
      if (modal) modal.classList.add('hidden');
    }

    // タスクガイダンス表示
    function showTaskGuidance(taskName) {
      const lang = document.body.getAttribute('data-lang') || 'ja';

      // 完全一致を試みた後、部分一致でフォールバック
      let lookupKey = taskName;
      if (!TASK_GUIDANCE[lookupKey]) {
        // 「?」やスペースの付着を除去して再試行
        lookupKey = taskName.replace(/\?/g, '').trim();
      }
      if (!TASK_GUIDANCE[lookupKey]) {
        // TASK_GUIDANCEのキーに含まれるか部分一致チェック
        const matchedKey = Object.keys(TASK_GUIDANCE).find(k => k === lookupKey || lookupKey.includes(k) || k.includes(lookupKey));
        if (matchedKey) lookupKey = matchedKey;
      }

      const guidanceJa = TASK_GUIDANCE[lookupKey];
      const guidanceEn = TASK_GUIDANCE_EN[lookupKey];

      if (!guidanceJa) {
        showModal(taskName, lang === 'ja' ? '<p>このタスクのガイダンスは準備中です。</p>' : '<p>Guidance for this task is not available.</p>');
        return;
      }

      // 言語に応じたデータソースを選択（英語データがない場合は日本語にフォールバック）
      const g = (lang === 'en' && guidanceEn) ? guidanceEn : guidanceJa;

      const content = `
        <h4>${lang === 'ja' ? 'タスクの目的' : 'Purpose'}</h4>
        <p>${g.description}</p>
        <h4>${lang === 'ja' ? '成果物' : 'Deliverable'}</h4>
        <p>${g.deliverable}</p>
        <h4>${lang === 'ja' ? 'ヒント' : 'Tips'}</h4>
        <ul>${g.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        <h4>${lang === 'ja' ? '完了チェックポイント' : 'Completion Checklist'}</h4>
        <ul>${g.checkpoints.map(c => `<li>${c}</li>`).join('')}</ul>
        ${guidanceJa.dependencies.length > 0 ? `
          <h4>${lang === 'ja' ? '前提タスク' : 'Prerequisites'}</h4>
          <p>${guidanceJa.dependencies.join(', ')}</p>
        ` : ''}
      `;
      showModal(taskName, content);
    }

    // 差し戻し理由入力
    function showBackReasonModal(row) {
      const lang = document.body.getAttribute('data-lang') || 'ja';
      const title = lang === 'ja' ? '差し戻し理由を入力' : 'Enter reason for sending back';
      const content = `
        <p>${lang === 'ja' ? '差し戻しの理由を入力してください。備考欄に記録されます。' : 'Please enter the reason. It will be recorded in the notes.'}</p>
        <textarea id="backReasonInput" style="width:100%;min-height:80px;margin-top:12px;" placeholder="${lang === 'ja' ? '例: 写真の解像度が不足しています' : 'e.g., Image resolution is insufficient'}"></textarea>
        <div style="margin-top:16px;text-align:right;">
          <button class="btn btn-secondary" onclick="closeModal()">${lang === 'ja' ? 'キャンセル' : 'Cancel'}</button>
          <button class="btn btn-primary" onclick="applyBackReason()" style="margin-left:8px;">${lang === 'ja' ? '記録する' : 'Record'}</button>
        </div>
      `;
      showModal(title, content);
      window._currentBackRow = row;
    }

    function applyBackReason() {
      const row = window._currentBackRow;
      if (!row) return;

      const reason = document.getElementById('backReasonInput')?.value?.trim();
      if (reason) {
        const notes = row.querySelector('td:nth-child(7) textarea');
        if (notes) {
          const timestamp = new Date().toLocaleString('ja-JP');
          const newNote = `[${timestamp} 差し戻し] ${reason}`;
          notes.value = newNote + (notes.value ? '\n' + notes.value : '');
        }
      }
      closeModal();
      window._currentBackRow = null;
    }

    // 状態変更ハンドラ（差し戻し時のモーダル表示）
    function onStatusChange(select) {
      const newStatus = select.value;
      const row = select.closest('.workflow-row');

      // 変更履歴ログ
      const taskCell = row.querySelector('td:nth-child(2)');
      const taskName = taskCell?.textContent?.replace('?', '').trim() || '';
      logChange(taskName, 'status', select.dataset.prevStatus || '', newStatus);
      select.dataset.prevStatus = newStatus;

      if (newStatus === 'back') {
        showBackReasonModal(row);
      }

      updateProgress();
      applyWorkflowFilters();
    }

    // 変更履歴ログ
    function logChange(taskName, field, oldValue, newValue) {
      if (oldValue === newValue) return;

      const log = getStoredJson('prWorkflowChangeLog') || [];
      log.unshift({
        timestamp: new Date().toISOString(),
        task: taskName,
        field: field,
        from: oldValue,
        to: newValue
      });
      // 最新100件のみ保持
      if (log.length > 100) log.pop();
      setStoredJson('prWorkflowChangeLog', log);
    }

    // 変更履歴表示
    function showChangeLog() {
      const log = getStoredJson('prWorkflowChangeLog') || [];
      const lang = document.body.getAttribute('data-lang') || 'ja';

      if (log.length === 0) {
        showModal(
          lang === 'ja' ? '変更履歴' : 'Change Log',
          `<p style="color:var(--gray-500);text-align:center;">${lang === 'ja' ? '変更履歴はありません' : 'No change history'}</p>`
        );
        return;
      }

      const statusLabels = {
        todo: lang === 'ja' ? '未着手' : 'Not Started',
        doing: lang === 'ja' ? '進行中' : 'In Progress',
        review: lang === 'ja' ? 'レビュー待ち' : 'Review',
        back: lang === 'ja' ? '差し戻し' : 'Back',
        done: lang === 'ja' ? '完了' : 'Done'
      };

      const content = log.slice(0, 50).map(entry => {
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleString('ja-JP');
        const fromLabel = statusLabels[entry.from] || entry.from || '-';
        const toLabel = statusLabels[entry.to] || entry.to;
        return `
          <div class="change-log-item">
            <div class="change-log-time">${escapeHtml(timeStr)}</div>
            <div class="change-log-task">${escapeHtml(entry.task)}</div>
            <div class="change-log-detail">${escapeHtml(fromLabel)} → ${escapeHtml(toLabel)}</div>
          </div>
        `;
      }).join('');

      showModal(lang === 'ja' ? '変更履歴（最新50件）' : 'Change Log (Latest 50)', content);
    }

    // タスク名セルにガイダンスボタンを追加
    function addGuidanceButtons() {
      document.querySelectorAll('.workflow-row').forEach((row, i) => {
        const taskCell = row.querySelector('td:nth-child(2)');
        if (!taskCell || taskCell.querySelector('.task-info-btn')) return;

        // タスク名は data-text-ja 属性を優先し、なければ textContent から取得
        let taskName = taskCell.dataset.textJa || '';
        if (!taskName) {
          // ボタンや警告を除いた純粋なテキストを取得
          const clone = taskCell.cloneNode(true);
          clone.querySelectorAll('.task-info-btn, .dependency-warning').forEach(el => el.remove());
          taskName = clone.textContent.trim();
          // 取得した日本語名を data 属性に保存（今後の参照用）
          if (taskName) taskCell.dataset.textJa = taskName;
        }
        if (!taskName || taskCell.querySelector('input')) return;

        const btn = document.createElement('button');
        btn.className = 'task-info-btn';
        btn.type = 'button';
        btn.textContent = '?';
        btn.title = document.body.getAttribute('data-lang') === 'ja' ? 'ガイダンスを表示' : 'Show guidance';
        btn.onclick = () => showTaskGuidance(taskName);
        taskCell.appendChild(btn);
      });
    }

    // 状態選択にイベントハンドラを設定
    function setupStatusHandlers() {
      document.querySelectorAll('.workflow-status').forEach(select => {
        if (select.dataset.handlerSet) return;
        select.dataset.handlerSet = 'true';
        select.dataset.prevStatus = select.value;
        // 既存のonchange属性を削除してイベントリスナーに統一
        select.removeAttribute('onchange');
        select.addEventListener('change', function() {
          onStatusChange(this);
        });
      });
    }

    // ============================
    // ビュー切替・カンバン・ガントチャート
    // ============================
    let currentWorkflowView = 'table';

    function switchWorkflowView(view, btn) {
      currentWorkflowView = view;
      // ボタンのアクティブ状態を更新
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');

      const tableEl = document.querySelector('.workflow-table');
      const kanbanEl = document.getElementById('kanbanView');
      const ganttEl = document.getElementById('ganttView');
      const filtersEl = document.querySelector('.workflow-filters');

      if (view === 'table') {
        tableEl.style.display = '';
        kanbanEl.style.display = 'none';
        ganttEl.style.display = 'none';
        if (filtersEl) filtersEl.style.display = '';
      } else if (view === 'kanban') {
        tableEl.style.display = 'none';
        kanbanEl.style.display = 'flex';
        ganttEl.style.display = 'none';
        if (filtersEl) filtersEl.style.display = 'none';
        renderKanbanView();
      } else if (view === 'gantt') {
        tableEl.style.display = 'none';
        kanbanEl.style.display = 'none';
        ganttEl.style.display = 'block';
        if (filtersEl) filtersEl.style.display = 'none';
        renderGanttView();
      }
    }

    // テーブルの行からタスクデータを収集
    function collectWorkflowData() {
      const rows = document.querySelectorAll('.workflow-row');
      const tasks = [];
      rows.forEach((row, idx) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 7) return;
        const phaseCell = cells[0];
        const taskCell = cells[1];
        const phase = (phaseCell.dataset.textJa || phaseCell.textContent.replace('≡', '').trim());
        const taskName = getTaskNameJa(taskCell);
        const assignee = row.querySelector('.workflow-assignee')?.value?.trim() || '';
        const startDateInput = row.querySelector('.workflow-start-date');
        const endDateInput = row.querySelector('.workflow-end-date');
        const startDate = startDateInput?.value || '';
        const endDate = endDateInput?.value || '';
        const status = normalizeWorkflowStatus(row.querySelector('.workflow-status')?.value || 'todo');
        const notesEl = cells[6]?.querySelector('textarea');
        const notes = notesEl?.value?.trim() || '';
        tasks.push({ idx, phase, task: taskName, assignee, startDate, endDate, status, notes, row });
      });
      return tasks;
    }

    // ============ カンバンビュー ============
    function renderKanbanView() {
      const container = document.getElementById('kanbanView');
      if (!container) return;
      const lang = document.body.getAttribute('data-lang') || 'ja';
      const tasks = collectWorkflowData();

      const statusConfig = [
        { key: 'todo',   labelJa: '未着手',       labelEn: 'Not Started' },
        { key: 'doing',  labelJa: '進行中',       labelEn: 'In Progress' },
        { key: 'review', labelJa: 'レビュー待ち', labelEn: 'In Review'   },
        { key: 'back',   labelJa: '差し戻し',     labelEn: 'Returned'    },
        { key: 'done',   labelJa: '完了',         labelEn: 'Done'        }
      ];

      const today = new Date(); today.setHours(0,0,0,0);
      const soonDate = new Date(today); soonDate.setDate(soonDate.getDate() + 3);

      const phaseTranslate = (p) => lang === 'en' ? (workflowTranslations.phases[p] || p) : p;
      const taskTranslate = (t) => lang === 'en' ? (workflowTranslations.tasks[t] || t) : t;

      container.innerHTML = statusConfig.map(sc => {
        const items = tasks.filter(t => t.status === sc.key);
        const label = lang === 'ja' ? sc.labelJa : sc.labelEn;

        const cardsHtml = items.length > 0 ? items.map(item => {
          let dueClass = '';
          let dateLabel = '';
          if (item.startDate && item.endDate) {
            dateLabel = `${item.startDate} → ${item.endDate}`;
          } else if (item.endDate) {
            dateLabel = item.endDate;
          } else if (item.startDate) {
            dateLabel = `${item.startDate} →`;
          }
          if (item.endDate && item.status !== 'done') {
            const d = new Date(item.endDate); d.setHours(0,0,0,0);
            if (d < today) dueClass = 'overdue';
            else if (d <= soonDate) dueClass = 'due-soon';
          }
          const safePhase = escapeHtml(phaseTranslate(item.phase));
          const safeTask = escapeHtml(taskTranslate(item.task));
          const safeAssignee = escapeHtml(item.assignee);
          const safeDateLabel = escapeHtml(dateLabel);
          const safeNotes = escapeHtml(item.notes.substring(0, 80));
          return `
            <div class="kanban-card" data-status="${item.status}" data-idx="${item.idx}" onclick="kanbanCardClick(${item.idx})">
              <div class="card-phase">${safePhase}</div>
              <div class="card-task">${safeTask}</div>
              <div class="card-meta">
                ${item.assignee ? `<span class="meta-assignee">${safeAssignee}</span>` : ''}
                ${dateLabel ? `<span class="meta-due ${dueClass}">📅 ${safeDateLabel}</span>` : ''}
              </div>
              ${item.notes ? `<div class="card-notes">${safeNotes}</div>` : ''}
            </div>
          `;
        }).join('') : `<div class="kanban-empty">${lang === 'ja' ? 'タスクなし' : 'No tasks'}</div>`;

        return `
          <div class="kanban-column" data-status="${sc.key}">
            <div class="kanban-column-header">
              <span>${label}</span>
              <span class="count-badge">${items.length}</span>
            </div>
            <div class="kanban-column-body">
              ${cardsHtml}
            </div>
          </div>
        `;
      }).join('');

      setupKanbanDragDrop();
    }

    function kanbanCardClick(idx) {
      const btn = document.querySelector('.view-btn[data-view="table"]');
      switchWorkflowView('table', btn);
      const rows = document.querySelectorAll('.workflow-row');
      if (rows[idx]) {
        rows[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        rows[idx].style.transition = 'background 0.3s';
        rows[idx].style.background = '#fef9c3';
        setTimeout(() => { rows[idx].style.background = ''; }, 2000);
      }
    }

    function setupKanbanDragDrop() {
      const cards = document.querySelectorAll('.kanban-card');
      cards.forEach(card => {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', card.dataset.idx);
          card.style.opacity = '0.5';
        });
        card.addEventListener('dragend', () => { card.style.opacity = '1'; });
      });

      const columns = document.querySelectorAll('.kanban-column-body');
      columns.forEach(col => {
        col.addEventListener('dragover', (e) => {
          e.preventDefault();
          col.style.background = 'rgba(37,99,235,0.05)';
        });
        col.addEventListener('dragleave', () => {
          col.style.background = '';
        });
        col.addEventListener('drop', (e) => {
          e.preventDefault();
          col.style.background = '';
          const idx = parseInt(e.dataTransfer.getData('text/plain'));
          const newStatus = col.closest('.kanban-column').dataset.status;
          const rows = document.querySelectorAll('.workflow-row');
          if (rows[idx]) {
            const select = rows[idx].querySelector('.workflow-status');
            if (select) {
              const oldStatus = select.value;
              select.value = newStatus;
              const taskCell = rows[idx].querySelector('td:nth-child(2)');
              const taskName = taskCell?.textContent?.replace('?', '').trim() || '';
              logChange(taskName, 'status', oldStatus, newStatus);
              select.dataset.prevStatus = newStatus;
              if (newStatus === 'back') {
                showBackReasonModal(rows[idx]);
              }
              updateProgress();
            }
          }
          renderKanbanView();
        });
      });
    }

    // ============ ガントチャートビュー（Notion風全面改善） ============
    let ganttDragState = null;

    function renderGanttView() {
      const container = document.getElementById('ganttView');
      if (!container) return;
      const lang = document.body.getAttribute('data-lang') || 'ja';
      const tasks = collectWorkflowData();

      // 日付範囲の計算
      const allDates = [];
      tasks.forEach(t => {
        if (t.startDate) allDates.push(new Date(t.startDate));
        if (t.endDate) allDates.push(new Date(t.endDate));
      });
      const today = new Date(); today.setHours(0,0,0,0);

      let minDate, maxDate;
      if (allDates.length === 0) {
        // 日付未設定でも今日を中心にチャートを表示
        minDate = new Date(today);
        maxDate = new Date(today);
      } else {
        minDate = new Date(Math.min(...allDates, today));
        maxDate = new Date(Math.max(...allDates, today));
      }
      minDate.setDate(minDate.getDate() - 5);
      maxDate.setDate(maxDate.getDate() + 14);
      minDate.setHours(0,0,0,0);
      maxDate.setHours(0,0,0,0);

      const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
      const dayWidth = 36;

      const phaseTranslate = (p) => lang === 'en' ? (workflowTranslations.phases[p] || p) : p;
      const taskTranslate = (t) => lang === 'en' ? (workflowTranslations.tasks[t] || t) : t;
      const statusLabelMap = {
        todo: lang === 'ja' ? '未着手' : 'Todo',
        doing: lang === 'ja' ? '進行中' : 'Doing',
        review: lang === 'ja' ? 'レビュー' : 'Review',
        back: lang === 'ja' ? '差し戻し' : 'Back',
        done: lang === 'ja' ? '完了' : 'Done'
      };

      // --- ヘッダー ---
      const dayHeaders = [];
      const monthMarkers = [];
      let lastMonth = -1;
      const dayNames = lang === 'ja' ? ['日','月','火','水','木','金','土'] : ['S','M','T','W','T','F','S'];

      for (let i = 0; i < totalDays; i++) {
        const d = new Date(minDate); d.setDate(d.getDate() + i);
        const dayNum = d.getDate();
        const dow = d.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isToday = d.getTime() === today.getTime();

        if (d.getMonth() !== lastMonth) {
          const monthLabel = lang === 'ja'
            ? `${d.getFullYear()}年${d.getMonth()+1}月`
            : d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          monthMarkers.push({ left: i * dayWidth, label: monthLabel });
          lastMonth = d.getMonth();
        }

        dayHeaders.push(`<div class="gantt-day-header ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" data-day-index="${i}">
          <span class="day-num">${dayNum}</span>
          <span class="day-name">${dayNames[dow]}</span>
        </div>`);
      }

      // --- フェーズグルーピング ---
      const phaseGroups = {};
      tasks.forEach(task => {
        const pKey = task.phase || '未分類';
        if (!phaseGroups[pKey]) phaseGroups[pKey] = [];
        phaseGroups[pKey].push(task);
      });

      // --- ラベル行 & タイムライン行 ---
      const labelRows = [];
      const timelineRows = [];

      Object.entries(phaseGroups).forEach(([phaseName, phaseTasks]) => {
        const safePhaseLabel = escapeHtml(phaseTranslate(phaseName));
        // フェーズヘッダー行
        labelRows.push(`<div class="gantt-label-row gantt-phase-header">
          <span class="label-phase-group">${safePhaseLabel}</span>
          <span class="label-phase-count">${phaseTasks.length}</span>
        </div>`);
        // フェーズ行用のタイムライン空行
        let phCells = '';
        for (let i = 0; i < totalDays; i++) {
          const d = new Date(minDate); d.setDate(d.getDate() + i);
          const dow = d.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isToday = d.getTime() === today.getTime();
          phCells += `<div class="gantt-cell ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" style="opacity:0.5;"></div>`;
        }
        timelineRows.push(`<div class="gantt-row gantt-row-phase">${phCells}</div>`);

        phaseTasks.forEach(task => {
          const tName = taskTranslate(task.task);
          const safeTaskName = escapeHtml(tName);
          const safeAssignee = escapeHtml(task.assignee);
          // ラベル行
          const statusOptions = ['todo','doing','review','back','done'];
          const statusSelectHtml = `<select class="gantt-status-select" data-s="${task.status}" data-idx="${task.idx}" onchange="ganttStatusChange(this)" onclick="event.stopPropagation()">
            ${statusOptions.map(s => `<option value="${s}" ${s === task.status ? 'selected' : ''}>${escapeHtml(statusLabelMap[s])}</option>`).join('')}
          </select>`;
          labelRows.push(`<div class="gantt-label-row gantt-task-row" data-idx="${task.idx}" onclick="ganttLabelClick(${task.idx})">
            ${statusSelectHtml}
            <span class="label-task" title="${safeTaskName}">${safeTaskName}</span>
            ${task.assignee ? `<span class="label-assignee">${safeAssignee}</span>` : ''}
          </div>`);

          // タイムライン行
          let barHtml = '';
          const hasStart = !!task.startDate;
          const hasEnd = !!task.endDate;

          if (hasStart || hasEnd) {
            const sDate = hasStart ? new Date(task.startDate) : (hasEnd ? new Date(task.endDate) : null);
            const eDate = hasEnd ? new Date(task.endDate) : (hasStart ? new Date(task.startDate) : null);
            if (sDate) sDate.setHours(0,0,0,0);
            if (eDate) eDate.setHours(0,0,0,0);

            const startOffset = Math.ceil((sDate - minDate) / (1000 * 60 * 60 * 24));
            const endOffset = Math.ceil((eDate - minDate) / (1000 * 60 * 60 * 24));
            const barLeft = startOffset * dayWidth;
            const barDays = Math.max(endOffset - startOffset + 1, 1);
            const barWidth = barDays * dayWidth - 4;

            // 進捗率（done=100%, doing=50%, review=75%, back=25%, todo=0%）
            const progressMap = { todo: 0, doing: 50, review: 75, back: 25, done: 100 };
            const progress = progressMap[task.status] || 0;

            const tooltipText = escapeHtml(`${tName}\n${lang === 'ja' ? '状態' : 'Status'}: ${statusLabelMap[task.status]}\n${lang === 'ja' ? '期間' : 'Period'}: ${task.startDate || '?'} → ${task.endDate || '?'}${task.assignee ? `\n${lang === 'ja' ? '担当' : 'Assignee'}: ${task.assignee}` : ''}`);

            barHtml = `<div class="gantt-bar" data-status="${task.status}" data-idx="${task.idx}"
              style="left:${barLeft}px;width:${barWidth}px;"
              title="${tooltipText}"
              onmousedown="ganttBarMouseDown(event, ${task.idx})"
              onclick="ganttBarClick(event, ${task.idx})">
              <div class="gantt-bar-progress" style="width:${progress}%"></div>
              <span class="gantt-bar-label">${safeTaskName}</span>
              <div class="gantt-bar-handle gantt-bar-handle-left" onmousedown="ganttResizeStart(event, ${task.idx}, 'left')"></div>
              <div class="gantt-bar-handle gantt-bar-handle-right" onmousedown="ganttResizeStart(event, ${task.idx}, 'right')"></div>
            </div>`;
          }

          let cellsHtml = '';
          for (let i = 0; i < totalDays; i++) {
            const d = new Date(minDate); d.setDate(d.getDate() + i);
            const dow = d.getDay();
            const isWeekend = dow === 0 || dow === 6;
            const isToday = d.getTime() === today.getTime();
            cellsHtml += `<div class="gantt-cell ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" data-day-index="${i}" data-idx="${task.idx}" onclick="ganttCellClick(event, ${task.idx}, ${i})"></div>`;
          }

          timelineRows.push(`<div class="gantt-row gantt-row-task" data-idx="${task.idx}">${cellsHtml}${barHtml}</div>`);
        });
      });

      // 今日の線
      const todayOffset = Math.ceil((today - minDate) / (1000 * 60 * 60 * 24));
      const todayLineLeft = todayOffset * dayWidth + dayWidth / 2;

      // 月マーカー
      const monthMarkersHtml = monthMarkers.map(m =>
        `<div class="gantt-month-header" style="left:${m.left}px;">${m.label}</div>`
      ).join('');

      // ツールバー
      const toolbarHtml = `<div class="gantt-toolbar">
        <button class="btn btn-secondary gantt-tool-btn" onclick="ganttScrollToToday()" title="${lang === 'ja' ? '今日に移動' : 'Go to today'}">
          📍 ${lang === 'ja' ? '今日' : 'Today'}
        </button>
        <div class="gantt-legend">
          <span class="gantt-legend-item"><span class="gantt-legend-dot" style="background:var(--gray-400)"></span>${lang === 'ja' ? '未着手' : 'Todo'}</span>
          <span class="gantt-legend-item"><span class="gantt-legend-dot" style="background:#f59e0b"></span>${lang === 'ja' ? '進行中' : 'Doing'}</span>
          <span class="gantt-legend-item"><span class="gantt-legend-dot" style="background:#3b82f6"></span>${lang === 'ja' ? 'レビュー' : 'Review'}</span>
          <span class="gantt-legend-item"><span class="gantt-legend-dot" style="background:#ef4444"></span>${lang === 'ja' ? '差し戻し' : 'Back'}</span>
          <span class="gantt-legend-item"><span class="gantt-legend-dot" style="background:#22c55e"></span>${lang === 'ja' ? '完了' : 'Done'}</span>
        </div>
      </div>`;

      container.innerHTML = `
        ${toolbarHtml}
        <div class="gantt-container" id="ganttContainer">
          <div class="gantt-labels">
            <div class="gantt-label-header">
              <span>${lang === 'ja' ? 'タスク' : 'Task'}</span>
            </div>
            ${labelRows.join('')}
          </div>
          <div class="gantt-timeline" id="ganttTimeline">
            <div class="gantt-timeline-header" style="width:${totalDays * dayWidth}px;position:relative;">
              ${monthMarkersHtml}
              <div style="display:flex;margin-top:22px;">${dayHeaders.join('')}</div>
            </div>
            <div class="gantt-timeline-body" style="position:relative;width:${totalDays * dayWidth}px;">
              ${timelineRows.join('')}
              <div class="gantt-today-line" style="left:${todayLineLeft}px;"></div>
            </div>
          </div>
        </div>
      `;

      // レンダリング後、今日に自動スクロール
      requestAnimationFrame(() => ganttScrollToToday());

      // ガントチャートのホバー連動
      setupGanttHoverSync();

      // 保存用のminDate/dayWidth
      container._ganttMinDate = minDate;
      container._ganttDayWidth = dayWidth;
    }

    function ganttScrollToToday() {
      const timeline = document.getElementById('ganttTimeline');
      if (!timeline) return;
      const todayLine = timeline.querySelector('.gantt-today-line');
      if (!todayLine) return;
      const left = parseInt(todayLine.style.left) - timeline.clientWidth / 3;
      timeline.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }

    function ganttLabelClick(idx) {
      // ラベルクリック → テーブルの該当行にジャンプ
      const btn = document.querySelector('.view-btn[data-view="table"]');
      switchWorkflowView('table', btn);
      const rows = document.querySelectorAll('.workflow-row');
      if (rows[idx]) {
        rows[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        rows[idx].style.transition = 'background 0.3s';
        rows[idx].style.background = '#fef9c3';
        setTimeout(() => { rows[idx].style.background = ''; }, 2000);
      }
    }

    function ganttBarClick(e, idx) {
      e.stopPropagation();
    }

    // --- ガントチャート上でステータス変更 ---
    function ganttStatusChange(selectEl) {
      const idx = parseInt(selectEl.dataset.idx);
      const newStatus = selectEl.value;
      const rows = document.querySelectorAll('.workflow-row');
      const row = rows[idx];
      if (!row) return;

      const tableSelect = row.querySelector('.workflow-status');
      if (tableSelect) {
        const oldStatus = tableSelect.value;
        tableSelect.value = newStatus;

        // 変更履歴を記録
        const taskCell = row.querySelector('td:nth-child(2)');
        const taskName = taskCell?.textContent?.replace('?', '').trim() || '';
        logChange(taskName, 'status', oldStatus, newStatus);
        tableSelect.dataset.prevStatus = newStatus;

        if (newStatus === 'back') {
          showBackReasonModal(row);
        }

        updateProgress();
        applyWorkflowFilters();
      }
      // ガントチャートを再描画
      renderGanttView();
    }

    // --- ガントバーのドラッグ移動 ---
    function ganttBarMouseDown(e, idx) {
      if (e.target.classList.contains('gantt-bar-handle-left') || e.target.classList.contains('gantt-bar-handle-right')) return;
      e.preventDefault();
      e.stopPropagation();
      const container = document.getElementById('ganttView');
      const dayWidth = container._ganttDayWidth || 36;
      const minDate = container._ganttMinDate;
      const bar = e.currentTarget;
      const startX = e.clientX;
      const origLeft = parseInt(bar.style.left);

      const rows = document.querySelectorAll('.workflow-row');
      const row = rows[idx];
      if (!row) return;
      const startInput = row.querySelector('.workflow-start-date');
      const endInput = row.querySelector('.workflow-end-date');
      const origStart = startInput?.value || '';
      const origEnd = endInput?.value || '';

      bar.classList.add('gantt-bar-dragging');

      function onMove(ev) {
        const dx = ev.clientX - startX;
        bar.style.left = (origLeft + dx) + 'px';
      }
      function onUp(ev) {
        bar.classList.remove('gantt-bar-dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const dx = ev.clientX - startX;
        const dayShift = Math.round(dx / dayWidth);
        if (dayShift === 0) return;
        if (origStart) {
          const d = new Date(origStart); d.setDate(d.getDate() + dayShift);
          startInput.value = dateToStr(d);
        }
        if (origEnd) {
          const d = new Date(origEnd); d.setDate(d.getDate() + dayShift);
          endInput.value = dateToStr(d);
        }
        checkDeadlines();
        renderGanttView();
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    // --- ガントバーのリサイズ ---
    function ganttResizeStart(e, idx, side) {
      e.preventDefault();
      e.stopPropagation();
      const container = document.getElementById('ganttView');
      const dayWidth = container._ganttDayWidth || 36;
      const bar = e.target.closest('.gantt-bar');
      const startX = e.clientX;
      const origLeft = parseInt(bar.style.left);
      const origWidth = parseInt(bar.style.width);

      const rows = document.querySelectorAll('.workflow-row');
      const row = rows[idx];
      if (!row) return;
      const startInput = row.querySelector('.workflow-start-date');
      const endInput = row.querySelector('.workflow-end-date');
      const origStart = startInput?.value || '';
      const origEnd = endInput?.value || '';

      bar.classList.add('gantt-bar-dragging');

      function onMove(ev) {
        const dx = ev.clientX - startX;
        if (side === 'right') {
          bar.style.width = Math.max(dayWidth - 4, origWidth + dx) + 'px';
        } else {
          bar.style.left = (origLeft + dx) + 'px';
          bar.style.width = Math.max(dayWidth - 4, origWidth - dx) + 'px';
        }
      }
      function onUp(ev) {
        bar.classList.remove('gantt-bar-dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const dx = ev.clientX - startX;
        const dayShift = Math.round(dx / dayWidth);
        if (dayShift === 0) return;
        if (side === 'right') {
          if (origEnd) {
            const d = new Date(origEnd); d.setDate(d.getDate() + dayShift);
            // 終了日が開始日より前にならないようにガード
            if (origStart && d < new Date(origStart)) return renderGanttView();
            endInput.value = dateToStr(d);
          } else if (origStart) {
            const d = new Date(origStart); d.setDate(d.getDate() + dayShift);
            endInput.value = dateToStr(d);
          }
        } else {
          if (origStart) {
            const d = new Date(origStart); d.setDate(d.getDate() + dayShift);
            // 開始日が終了日より後にならないようにガード
            if (origEnd && d > new Date(origEnd)) return renderGanttView();
            startInput.value = dateToStr(d);
          } else if (origEnd) {
            const d = new Date(origEnd); d.setDate(d.getDate() + dayShift);
            startInput.value = dateToStr(d);
          }
        }
        checkDeadlines();
        renderGanttView();
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    // --- 空セルクリックで日付設定 ---
    function ganttCellClick(e, idx, dayIndex) {
      if (e.target.classList.contains('gantt-bar') || e.target.closest('.gantt-bar')) return;
      const container = document.getElementById('ganttView');
      const minDate = container._ganttMinDate;
      const d = new Date(minDate); d.setDate(d.getDate() + dayIndex);

      const rows = document.querySelectorAll('.workflow-row');
      const row = rows[idx];
      if (!row) return;
      const startInput = row.querySelector('.workflow-start-date');
      const endInput = row.querySelector('.workflow-end-date');

      if (!startInput.value) {
        startInput.value = dateToStr(d);
      } else if (!endInput.value) {
        const s = new Date(startInput.value);
        if (d >= s) {
          endInput.value = dateToStr(d);
        } else {
          endInput.value = startInput.value;
          startInput.value = dateToStr(d);
        }
      } else {
        // 両方設定済みの場合は開始日を変更
        startInput.value = dateToStr(d);
        if (new Date(d) > new Date(endInput.value)) {
          endInput.value = dateToStr(d);
        }
      }
      checkDeadlines();
      renderGanttView();
    }

    function dateToStr(d) {
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    // --- ホバー連動 ---
    function setupGanttHoverSync() {
      const labelRows = document.querySelectorAll('.gantt-label-row.gantt-task-row');
      const timelineRows = document.querySelectorAll('.gantt-row.gantt-row-task');

      labelRows.forEach(lr => {
        const idx = lr.dataset.idx;
        const tr = document.querySelector(`.gantt-row.gantt-row-task[data-idx="${idx}"]`);
        if (!tr) return;
        lr.addEventListener('mouseenter', () => { lr.classList.add('gantt-hover'); tr.classList.add('gantt-hover'); });
        lr.addEventListener('mouseleave', () => { lr.classList.remove('gantt-hover'); tr.classList.remove('gantt-hover'); });
        tr.addEventListener('mouseenter', () => { lr.classList.add('gantt-hover'); tr.classList.add('gantt-hover'); });
        tr.addEventListener('mouseleave', () => { lr.classList.remove('gantt-hover'); tr.classList.remove('gantt-hover'); });
      });
    }

    // 進捗更新時にカンバン/ガントも更新
    const _originalUpdateProgress = typeof updateProgress === 'function' ? updateProgress : null;

    // 初期化
    document.addEventListener('DOMContentLoaded', () => {
      // 保存された言語設定を読み込み
      const savedLang = localStorage.getItem('prWorkflowLang') || 'ja';
      document.body.setAttribute('data-lang', savedLang);
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(savedLang === 'ja' ? '日本語' : 'English'));
      });
      updatePlaceholders(savedLang);

      // クイックスタートの初回表示
      const firstRun = localStorage.getItem('prWorkflowFirstRun');
      if (firstRun === null) {
        showQuickStart();
      }

      // 締めくくり質問の初期化
      const closingQ = document.getElementById('closingQuestion');
      if (closingQ) {
        closingQ.value = savedLang === 'ja'
          ? '他に伝えておきたいことはありますか？'
          : 'Is there anything else you would like to share?';
      }

      // 必須入力の監視
      document.querySelectorAll('[data-required="true"]').forEach(field => {
        field.addEventListener('input', updateRequiredState);
        field.addEventListener('change', updateRequiredState);
      });

      loadData();
      updateProgress();
      updateRequiredState();
      applyWorkflowFilters();
      enableWorkflowDrag();
      addGuidanceButtons();
      setupStatusHandlers();
      if (!document.querySelector('.interviewee-card')) {
        addInterviewee();
      }
      setInterviewType('direct');

      // 担当者変更時にも作業量を更新
      document.querySelectorAll('.workflow-assignee').forEach(input => {
        input.addEventListener('change', updateAssigneeWorkload);
        input.addEventListener('input', updateAssigneeWorkload);
      });

      // 期限変更時に警告をチェック
      document.querySelectorAll('.workflow-start-date, .workflow-end-date').forEach(input => {
        input.addEventListener('change', () => { checkDeadlines(); updateProgress(); });
      });
    });
