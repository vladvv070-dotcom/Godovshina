/* =========================================================
   Квест-календарь годовщины — Логика + Сентябрьский квест
========================================================= */

(function () {
  'use strict';

  /* ---------- 1. ДАННЫЕ ---------- */
  var CYCLE_START_YEARS = [2026, 2027, 2028, 2029];
  var MONTH_SEQUENCE = [
    { name: 'Августа',   month: 7,  yearOffset: 0 },
    { name: 'Сентября',  month: 8,  yearOffset: 0 },
    { name: 'Октября',   month: 9,  yearOffset: 0 },
    { name: 'Ноября',    month: 10, yearOffset: 0 },
    { name: 'Декабря',   month: 11, yearOffset: 0 },
    { name: 'Января',    month: 0,  yearOffset: 1 },
    { name: 'Февраля',   month: 1,  yearOffset: 1 },
    { name: 'Мартa',     month: 2,  yearOffset: 1 },
    { name: 'Апреля',    month: 3,  yearOffset: 1 },
    { name: 'Мая',       month: 4,  yearOffset: 1 },
    { name: 'Июня',      month: 5,  yearOffset: 1 },
    { name: 'Июля',      month: 6,  yearOffset: 1 },
    { name: 'Августа',   month: 7,  yearOffset: 1 }
  ];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function buildQuestId(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }

  function buildCycles() {
    return CYCLE_START_YEARS.map(function (startYear) {
      var quests = MONTH_SEQUENCE.map(function (entry, index) {
        var date = new Date(startYear + entry.yearOffset, entry.month, 23, 0, 0, 0, 0);
        return {
          id: buildQuestId(date), date: date, monthName: entry.name,
          isFirst: index === 0, isFinal: index === MONTH_SEQUENCE.length - 1
        };
      });
      return { label: startYear + ' \u2014 ' + (startYear + 1), startYear: startYear, quests: quests };
    });
  }

  var CYCLES = buildCycles();
  var TIMELINE = [];
  var seen = {};
  CYCLES.forEach(function (cycle) {
    cycle.quests.forEach(function (q) {
      if (!seen[q.id]) { seen[q.id] = true; TIMELINE.push(q); }
    });
  });
  TIMELINE.sort(function (a, b) { return a.date - b.date; });

  /* ---------- 2. СОСТОЯНИЕ ---------- */
  var STORAGE_KEY = 'anniversaryQuest.completed.v1';

  function loadCompleted() {
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  function saveCompleted(map) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function sanitizeLocalStorage() {
    var map = loadCompleted();
    var now = new Date();
    var changed = false;
    TIMELINE.forEach(function (quest) {
      if (map[quest.id] && quest.date > now) {
        delete map[quest.id];
        changed = true;
      }
    });
    if (changed) saveCompleted(map);
    return map;
  }

  var completedMap = sanitizeLocalStorage();
  function isCompleted(id) { return !!completedMap[id]; }
  function markCompleted(id) { completedMap[id] = true; saveCompleted(completedMap); }

  /* ---------- 3. СТАТУСЫ ---------- */
  function computeStatuses(now) {
    var statusById = {};
    var foundActive = false;
    var foundNextUpcoming = false;

    TIMELINE.forEach(function (q) { if (isCompleted(q.id)) statusById[q.id] = 'done'; });

    for (var i = 0; i < TIMELINE.length; i++) {
      var q = TIMELINE[i];
      if (statusById[q.id] === 'done') continue;

      if (q.date <= now) {
        if (!foundActive) { statusById[q.id] = 'active'; foundActive = true; } 
        else { statusById[q.id] = 'overdue'; }
      } else {
        if (!foundNextUpcoming) { statusById[q.id] = 'soon'; foundNextUpcoming = true; } 
        else { statusById[q.id] = 'closed'; }
      }
    }
    return statusById;
  }

  /* ---------- 4. РЕНДЕР И ЖИДКОЕ СТЕКЛО ---------- */
  var grid = document.getElementById('questGrid');
  var cycleTitle = document.getElementById('cycleTitle');
  var prevBtn = document.getElementById('prevCycle');
  var nextBtn = document.getElementById('nextCycle');

  var STATUS_LABEL = { done: 'Выполнено', soon: 'Скоро', closed: 'Закрыто', overdue: 'Просрочено', active: 'Открыто' };

  function buildCard(quest, status, delayIndex) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'quest-card quest-card--' + status;
    if (quest.isFinal) card.classList.add('quest-card--final');
    if (quest.isFinal && status !== 'closed') card.classList.add('has-glow');
    card.style.animationDelay = (delayIndex * 0.035) + 's';
    
    var num = document.createElement('div');
    num.className = 'quest-card__num'; num.textContent = '23';

    var month = document.createElement('div');
    month.className = 'quest-card__month'; month.textContent = quest.monthName;

    var stamp = document.createElement('div');
    stamp.className = 'stamp-line stamp-line--' + status;
    stamp.textContent = STATUS_LABEL[status];
    stamp.style.setProperty('--stamp-delay', (0.15 + delayIndex * 0.03) + 's');

    card.appendChild(num); card.appendChild(month); card.appendChild(stamp);
    card.addEventListener('click', function () { openQuestModal(quest, status); });
    return card;
  }

  var currentIndex = 0;

  function renderGridContent(index) {
    var cycle = CYCLES[index];
    var statusById = computeStatuses(new Date());
    grid.innerHTML = '';
    cycle.quests.forEach(function (quest, i) {
      grid.appendChild(buildCard(quest, statusById[quest.id], i));
    });
    cycleTitle.innerHTML = cycle.label.replace(' \u2014 ', '&nbsp;&mdash;&nbsp;');
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === CYCLES.length - 1;
  }

  function changeCycleLiquid(newIndex) {
    if (newIndex < 0 || newIndex >= CYCLES.length || newIndex === currentIndex) return;
    var dir = newIndex > currentIndex ? -1 : 1; 
    grid.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.3s ease, opacity 0.3s ease';
    grid.style.transform = 'scale(0.85) skewX(' + (dir * 12) + 'deg) rotateY(' + (dir * -15) + 'deg)';
    grid.style.filter = 'blur(25px) saturate(300%)';
    grid.style.opacity = '0.3';
    cycleTitle.classList.add('is-distorting');

    setTimeout(function() {
      currentIndex = newIndex;
      renderGridContent(currentIndex);
      grid.style.transform = 'scale(1) skewX(0deg) rotateY(0deg)';
      grid.style.filter = 'blur(0px) saturate(100%)';
      grid.style.opacity = '1';
      cycleTitle.classList.remove('is-distorting');
      setTimeout(function() {
        grid.style.transition = ''; grid.style.transform = ''; grid.style.filter = ''; grid.style.opacity = '';
      }, 400);
    }, 250);
  }

  prevBtn.addEventListener('click', function () { changeCycleLiquid(currentIndex - 1); });
  nextBtn.addEventListener('click', function () { changeCycleLiquid(currentIndex + 1); });

  var viewport = document.getElementById('cyclesViewport');
  var dragStartX = 0, dragDeltaX = 0, isDragging = false;

  viewport.addEventListener('touchstart', function (e) {
    isDragging = true; dragStartX = e.touches[0].clientX; grid.style.transition = 'none';
  }, { passive: true });

  viewport.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    dragDeltaX = e.touches[0].clientX - dragStartX;
    var progress = Math.min(Math.abs(dragDeltaX) / 180, 1);
    var skew = (dragDeltaX / 180) * 15;
    var blur = progress * 20;
    var scale = 1 - (progress * 0.15);
    grid.style.transform = 'scale(' + scale + ') skewX(' + skew + 'deg)';
    grid.style.filter = 'blur(' + blur + 'px) saturate(' + (100 + progress * 200) + '%)';
    grid.style.opacity = 1 - (progress * 0.4);
  }, { passive: true });

  viewport.addEventListener('touchend', function () {
    if (!isDragging) return;
    isDragging = false;
    if (Math.abs(dragDeltaX) > 80) {
      var nextIndex = dragDeltaX < 0 ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex >= 0 && nextIndex < CYCLES.length) changeCycleLiquid(nextIndex);
      else resetGridFluid();
    } else {
      resetGridFluid();
    }
    dragDeltaX = 0;
  });

  function resetGridFluid() {
    grid.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.4s ease, opacity 0.4s ease';
    grid.style.transform = 'scale(1) skewX(0deg)';
    grid.style.filter = 'blur(0px) saturate(100%)';
    grid.style.opacity = '1';
    setTimeout(function() { grid.style.transition = ''; }, 400);
  }


  /* ---------- 5. СЕНТЯБРЬСКИЙ КВЕСТ (ЛОГИКА) ---------- */
  function mountSeptemberQuest(container) {
    container.innerHTML = `
      <div class="quest-sept-container">
        <!-- Этап 1 -->
        <div id="sept-step-1" class="quest-sept-step is-active">
          <p class="quest-modal__text">Откройте сайт NextCubePro.com на компьютере.<br><br>Откройте инструменты разработчика (F12) и выполните указанное действие.<br><br>Действие: введите "gdjstwvwb"</p>
          <input type="text" id="sept-code-input" class="quest-sept-input" placeholder="Введите код" autocomplete="off" />
          <button id="sept-code-submit" class="quest-sept-btn quest-sept-btn--primary" style="width:100%;">Подтвердить</button>
          <p id="sept-error" class="quest-sept-error">Неверный код, попробуйте снова</p>
        </div>

        <!-- Этап 2 -->
        <div id="sept-step-2" class="quest-sept-step">
          <p class="quest-modal__text">Подсказка к физической записке:</p>
          <div class="quest-sept-hint">Lamborghini Urus</div>
          <button id="sept-found-btn" class="quest-sept-btn quest-sept-btn--primary" style="display:none; width:100%; margin-top:20px;">Я нашёл/нашла записку</button>
        </div>

        <!-- Этап 3 -->
        <div id="sept-step-3" class="quest-sept-step">
          <div class="quest-sept-coord">37.401437, -116.867730</div>
          <p class="quest-modal__text" style="font-size:14px; margin-bottom:15px;">Откройте координаты в Google Maps/Earth и нарисуйте найденную фигуру.</p>
          
          <div class="quest-sept-canvas-wrap">
            <canvas id="sept-canvas" class="quest-sept-canvas"></canvas>
          </div>
          
          <!-- Новые кнопки истории -->
          <div class="quest-sept-btn-group">
            <button id="sept-canvas-undo" class="quest-sept-btn">Отменить</button>
            <button id="sept-canvas-redo" class="quest-sept-btn">Вернуть</button>
            <button id="sept-canvas-clear" class="quest-sept-btn">Очистить</button>
          </div>

          <div class="quest-sept-btn-row">
            <button id="sept-canvas-submit" class="quest-sept-btn quest-sept-btn--primary" style="width: 100%;">Проверить</button>
          </div>
          <p id="sept-draw-error" class="quest-sept-error">Форма не распознана, попробуйте точнее</p>
        </div>

        <!-- Этап 4 (Финал) -->
        <div id="sept-step-4" class="quest-sept-step" style="padding-top: 20px;">
          <svg id="sept-symbol" class="quest-sept-final-symbol" viewBox="0 0 100 100" width="160" height="160">
            <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="2.5"/>
            <path d="M 6 50 Q 50 15 94 50 Q 50 85 6 50" fill="none" stroke="currentColor" stroke-width="2.5"/>
            <path d="M 50 2 L 25 30 L 75 30 Z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M 50 98 L 25 70 L 75 70 Z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M 2 50 L 25 25 L 25 75 Z" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M 98 50 L 75 25 L 75 75 Z" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          <div id="sept-letter" class="quest-sept-final-letter">S</div>
          <div id="sept-remember" class="quest-sept-final-text">Remember it.</div>
        </div>
      </div>
    `;

    var codeInput = document.getElementById('sept-code-input');
    var codeSubmit = document.getElementById('sept-code-submit');
    var codeError = document.getElementById('sept-error');

    codeSubmit.addEventListener('click', function() {
      if (codeInput.value.trim().toUpperCase() === 'N7K4P9X2') {
        document.getElementById('sept-step-1').classList.remove('is-active');
        document.getElementById('sept-step-2').classList.add('is-active');
        
        setTimeout(function() {
          var foundBtn = document.getElementById('sept-found-btn');
          if(foundBtn) {
            foundBtn.style.display = 'block';
            foundBtn.style.animation = 'fade-in 0.4s ease forwards';
          }
        }, 20000);
      } else {
        codeError.style.display = 'block';
      }
    });

    var foundBtn = document.getElementById('sept-found-btn');
    foundBtn.addEventListener('click', function() {
      document.getElementById('sept-step-2').classList.remove('is-active');
      document.getElementById('sept-step-3').classList.add('is-active');
      initCanvas();
    });

    // Логика Этапа 3 (Холст с Историей и Распознаванием)
    var canvas, ctx, isDrawing = false;
    var strokes = []; // Массив всех штрихов
    var redoStrokes = []; // Отмененные штрихи
    var currentStroke = null; // Текущая линия, которую рисуем

    function redrawCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000000'; // Рисуем чёрной пастой
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      strokes.forEach(function(stroke) {
        if(stroke.length === 0) return;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for(var i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      });
    }

    function initCanvas() {
      canvas = document.getElementById('sept-canvas');
      ctx = canvas.getContext('2d');
      
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      redrawCanvas(); // Задать стили кисти при инициализации

      function getPos(e) {
        var r = canvas.getBoundingClientRect();
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        var clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - r.left, y: clientY - r.top };
      }

      function startDraw(e) {
        e.preventDefault(); isDrawing = true;
        var p = getPos(e);
        currentStroke = [p];
        strokes.push(currentStroke);
        redoStrokes = []; // Очищаем историю возвратов при новом рисовании
        
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
      }

      function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        var p = getPos(e);
        currentStroke.push(p);
        ctx.lineTo(p.x, p.y); ctx.stroke();
      }

      function endDraw(e) { 
        if(!isDrawing) return;
        e.preventDefault(); isDrawing = false; 
      }

      canvas.addEventListener('touchstart', startDraw, {passive: false});
      canvas.addEventListener('touchmove', draw, {passive: false});
      canvas.addEventListener('touchend', endDraw, {passive: false});
      canvas.addEventListener('mousedown', startDraw);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', endDraw);
      canvas.addEventListener('mouseleave', endDraw);
    }
    
    // Кнопка Отменить
    document.getElementById('sept-canvas-undo').addEventListener('click', function() {
      if(strokes.length > 0) {
        redoStrokes.push(strokes.pop());
        redrawCanvas();
        document.getElementById('sept-draw-error').style.display = 'none';
      }
    });

    // Кнопка Вернуть
    document.getElementById('sept-canvas-redo').addEventListener('click', function() {
      if(redoStrokes.length > 0) {
        strokes.push(redoStrokes.pop());
        redrawCanvas();
        document.getElementById('sept-draw-error').style.display = 'none';
      }
    });

    // Кнопка Очистить
    document.getElementById('sept-canvas-clear').addEventListener('click', function() {
      strokes = [];
      redoStrokes = [];
      redrawCanvas();
      document.getElementById('sept-draw-error').style.display = 'none';
    });

    // Проверить фигуру
    document.getElementById('sept-canvas-submit').addEventListener('click', function() {
      // Собираем все нарисованные точки в один массив для анализатора
      var flatPoints = [];
      strokes.forEach(function(s) { flatPoints = flatPoints.concat(s); });
      
      if (checkShape(flatPoints, canvas.width, canvas.height)) {
        document.getElementById('sept-step-3').classList.remove('is-active');
        document.getElementById('sept-step-4').classList.add('is-active');
        runFinalSequence();
      } else {
        document.getElementById('sept-draw-error').style.display = 'block';
      }
    });
  }

  // Алгоритм распознавания фигуры (Окружность + "Глаз" по центру + Лучи/Треугольники)
  function checkShape(pointsArray, cWidth, cHeight) {
    if (pointsArray.length < 20) return false;

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pointsArray.forEach(function(p) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    var w = maxX - minX, h = maxY - minY;
    // Фигура должна быть достаточно большой
    if (w < cWidth * 0.4 || h < cHeight * 0.4) return false;

    // Создаем матрицу 10x10 для проверки распределения линий
    var grid = [];
    for (var i = 0; i < 10; i++) { grid[i] = [0,0,0,0,0,0,0,0,0,0]; }

    pointsArray.forEach(function(p) {
      var gx = Math.floor(((p.x - minX) / w) * 9.99);
      var gy = Math.floor(((p.y - minY) / h) * 9.99);
      grid[gy][gx] = 1;
    });

    var totalFilled = 0;
    var hasCenter = false, hasTop = false, hasBottom = false, hasLeft = false, hasRight = false;

    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 10; x++) {
        if (grid[y][x] === 1) {
          totalFilled++;
          // Проверяем наличие штрихов в ключевых зонах фигуры
          if (y >= 4 && y <= 5 && x >= 2 && x <= 7) hasCenter = true; // Центральный эллипс/глаз
          if (y >= 0 && y <= 1 && x >= 3 && x <= 6) hasTop = true;    // Верхний край
          if (y >= 8 && y <= 9 && x >= 3 && x <= 6) hasBottom = true; // Нижний край
          if (x >= 0 && x <= 1 && y >= 3 && y <= 6) hasLeft = true;   // Левый край
          if (x >= 8 && x <= 9 && y >= 3 && y <= 6) hasRight = true;  // Правый край
        }
      }
    }

    // Защита от "просто закрасил весь холст"
    if (totalFilled > 70) return false; 
    
    // Если есть рисунок во всех ключевых зонах, считаем распознанным
    return hasCenter && hasTop && hasBottom && hasLeft && hasRight;
  }

  // Финальная секвенция с буквой S
  function runFinalSequence() {
    var symbol = document.getElementById('sept-symbol');
    var letter = document.getElementById('sept-letter');
    var remember = document.getElementById('sept-remember');

    symbol.style.opacity = '1';
    
    setTimeout(function() {
      symbol.style.opacity = '0';
      
      setTimeout(function() {
        symbol.style.display = 'none';
        letter.style.display = 'block';
        
        setTimeout(function() { letter.style.opacity = '1'; }, 50);

        setTimeout(function() {
          remember.style.opacity = '1';
          
          setTimeout(function() {
            if (activeModalQuestId) {
              markCompleted(activeModalQuestId);
              closeQuestModal();
              renderGridContent(currentIndex);
            }
          }, 3000);
        }, 1500);
      }, 800);
    }, 2500);
  }


  /* ---------- 6. ПОЛНОЭКРАННАЯ МОДАЛКА ---------- */
  var modal = document.getElementById('questModal');
  var modalBackdrop = document.getElementById('questModalBackdrop');
  var modalClose = document.getElementById('questModalClose');
  var modalTitle = document.getElementById('questModalTitle');
  var modalStatusBadge = document.getElementById('questModalStatusBadge');
  
  var modalBody = document.getElementById('questModalBody');
  var defaultCard = document.getElementById('questModalDefaultCard');
  var defaultText = document.getElementById('questModalText');
  var modalFooter = document.getElementById('questModalFooter');
  var modalCompleteBtn = document.getElementById('questModalComplete');
  var activeModalQuestId = null;

  function openQuestModal(quest, status) {
    activeModalQuestId = quest.id;
    modalTitle.textContent = '23 ' + quest.monthName;
    modalStatusBadge.textContent = STATUS_LABEL[status];
    modalStatusBadge.className = 'quest-modal__status-badge stamp-line--' + status;
    
    var existingSept = modalBody.querySelector('.quest-sept-container');
    if (existingSept) existingSept.remove();
    
    if (quest.monthName === 'Сентября' && (status === 'active' || status === 'overdue')) {
      defaultCard.style.display = 'none';
      modalFooter.style.display = 'none';
      mountSeptemberQuest(modalBody);
    } else {
      defaultCard.style.display = 'block';
      modalFooter.style.display = 'block';

      if (status === 'done') {
        defaultText.textContent = 'Испытание для этого дня успешно выполнено.';
        modalCompleteBtn.textContent = 'Уже пройдено';
        modalCompleteBtn.setAttribute('disabled', 'disabled');
      } else if (status === 'soon' || status === 'closed') {
        defaultText.textContent = 'Эта дата еще не наступила. Подсказки и задания станут доступны точно в назначенный день.';
        modalCompleteBtn.textContent = 'Дата еще не наступила';
        modalCompleteBtn.setAttribute('disabled', 'disabled');
      } else {
        defaultText.textContent = 'Задание открыто. Исследуйте подсказки этого дня и отметьте этап пройденным после выполнения. Желаем успеха!';
        modalCompleteBtn.textContent = 'Отметить пройденным';
        modalCompleteBtn.removeAttribute('disabled');
      }
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeQuestModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    activeModalQuestId = null;
  }

  modalBackdrop.addEventListener('click', closeQuestModal);
  modalClose.addEventListener('click', closeQuestModal);

  modalCompleteBtn.addEventListener('click', function () {
    if (!activeModalQuestId) return;
    markCompleted(activeModalQuestId);
    closeQuestModal();
    renderGridContent(currentIndex);
  });

  /* ---------- ЗАПУСК ---------- */
  renderGridContent(0);

})();