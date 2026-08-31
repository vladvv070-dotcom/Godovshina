/* =========================================================
   Anniversary Quest Calendar — Core Logic + September Quest
========================================================= */

(function () {
  'use strict';

  /* ---------- 1. DATA ---------- */
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

  /* ---------- 2. STORAGE & SANITIZATION ---------- */
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

  /* ---------- 3. STATUSES ---------- */
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

  /* ---------- 4. RENDER ---------- */
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


  /* ---------- 5. SEPTEMBER QUEST LOGIC ---------- */
  var septInterval = null;
  var septInactivityTimer = null;

  function mountSeptemberQuest(container) {
    container.innerHTML = `
      <div class="quest-sept-container">
        <!-- Step 1 -->
        <div id="sept-step-1" class="quest-sept-step is-active">
          <p class="quest-modal__text">Откройте сайт NextCubePro.com на компьютере.<br><br>Откройте инструменты разработчика (F12) и выполните указанное действие.<br><br>Действие: введите "gdjstwvwb"</p>
          <input type="text" id="sept-code-input" class="quest-sept-input" placeholder="Введите код" autocomplete="off" />
          <button id="sept-code-submit" class="quest-sept-btn quest-sept-btn--primary" style="width:100%;">Подтвердить</button>
          <p id="sept-error" class="quest-sept-error">Неверный код, попробуйте снова</p>
        </div>

        <!-- Step 2 -->
        <div id="sept-step-2" class="quest-sept-step">
          <p class="quest-modal__text">Подсказка к физической записке:</p>
          <div class="quest-sept-hint">Lamborghini Urus</div>
          <button id="sept-found-btn" class="quest-sept-btn quest-sept-btn--primary" style="display:none; width:100%; margin-top:20px;">Я нашёл/нашла записку</button>
        </div>

        <!-- Step 3 -->
        <div id="sept-step-3" class="quest-sept-step">
          <div class="quest-sept-coord">37.401437, -116.867730</div>
          <p class="quest-modal__text" style="font-size:14px; margin-bottom:12px;">Откройте координаты в Google Maps/Earth и нарисуйте найденную фигуру.</p>
          
          <div class="quest-sept-canvas-wrap" id="sept-canvas-wrap">
            <canvas id="sept-canvas" class="quest-sept-canvas"></canvas>
          </div>
          
          <div class="quest-sept-btn-group">
            <button id="sept-canvas-undo" class="quest-sept-btn">Отменить</button>
            <button id="sept-canvas-redo" class="quest-sept-btn">Вернуть</button>
            <button id="sept-canvas-clear" class="quest-sept-btn">Очистить</button>
          </div>

          <p id="sept-draw-error" class="quest-sept-error">Форма не распознана, попробуйте точнее</p>
        </div>

        <!-- Step 4 (Final particle sequence) -->
        <div id="sept-step-4" class="quest-sept-step">
          <div class="quest-sept-final-wrap" id="sept-final-wrap">
            <img id="sept-gold-img" class="quest-sept-gold-img" src="1000035695.png" alt="Символ" />
            <canvas id="sept-particles-canvas" class="quest-sept-particles-canvas"></canvas>
            <div id="sept-remember" class="quest-sept-remember-text">Remember it.</div>
          </div>
        </div>
      </div>
    `;

    var codeInput = document.getElementById('sept-code-input');
    var codeSubmit = document.getElementById('sept-code-submit');
    var codeError = document.getElementById('sept-error');

    function handleCodeSubmit() {
      if (codeInput.value.trim().toUpperCase() === 'N7K4P9X2') {
        codeInput.classList.remove('is-error');
        codeError.style.display = 'none';
        
        document.getElementById('sept-step-1').classList.remove('is-active');
        document.getElementById('sept-step-2').classList.add('is-active');
        
        setTimeout(function() {
          var foundBtn = document.getElementById('sept-found-btn');
          if(foundBtn) {
            foundBtn.style.display = 'block';
            foundBtn.classList.add('btn-fade-enter');
          }
        }, 20000);
      } else {
        codeInput.classList.remove('is-error');
        void codeInput.offsetWidth; // Reflow trigger to restart animation
        codeInput.classList.add('is-error');
        codeError.style.display = 'block';
      }
    }

    codeSubmit.addEventListener('click', handleCodeSubmit);
    codeInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleCodeSubmit();
    });

    var foundBtn = document.getElementById('sept-found-btn');
    foundBtn.addEventListener('click', function() {
      document.getElementById('sept-step-2').classList.remove('is-active');
      document.getElementById('sept-step-3').classList.add('is-active');
      initCanvas();
    });

    /* ---------- CANVAS LOGIC & AUTO OCR ---------- */
    var canvas, ctx, isDrawing = false;
    var strokes = [];
    var redoStrokes = [];
    var currentStroke = null;
    var canvasWrap = document.getElementById('sept-canvas-wrap');
    var drawError = document.getElementById('sept-draw-error');

    function redrawCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#030612';
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
      canvas.width = rect.width || 280;
      canvas.height = rect.height || 280;
      
      redrawCanvas();

      function getPos(e) {
        var r = canvas.getBoundingClientRect();
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        var clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - r.left, y: clientY - r.top };
      }

      function startDraw(e) {
        e.preventDefault(); isDrawing = true;
        resetInactivityTimer();
        var p = getPos(e);
        currentStroke = [p];
        strokes.push(currentStroke);
        redoStrokes = [];
        drawError.style.display = 'none';
        
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
      }

      function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        resetInactivityTimer();
        var p = getPos(e);
        currentStroke.push(p);
        ctx.lineTo(p.x, p.y); ctx.stroke();
      }

      function endDraw(e) { 
        if(!isDrawing) return;
        e.preventDefault(); isDrawing = false; 
        resetInactivityTimer();
        evaluateCurrentDrawing();
      }

      canvas.addEventListener('touchstart', startDraw, {passive: false});
      canvas.addEventListener('touchmove', draw, {passive: false});
      canvas.addEventListener('touchend', endDraw, {passive: false});
      canvas.addEventListener('mousedown', startDraw);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', endDraw);
      canvas.addEventListener('mouseleave', endDraw);

      // Auto-evaluation every 1 second
      if (septInterval) clearInterval(septInterval);
      septInterval = setInterval(function() {
        evaluateCurrentDrawing();
      }, 1000);
    }

    function resetInactivityTimer() {
      if (septInactivityTimer) clearTimeout(septInactivityTimer);
      
      // 10-second inactivity timer
      septInactivityTimer = setTimeout(function() {
        var flatPoints = [];
        strokes.forEach(function(s) { flatPoints = flatPoints.concat(s); });
        
        if (flatPoints.length > 10) {
          var matchScore = evaluateShapeScore(flatPoints, canvas.width, canvas.height);
          if (matchScore >= 0.60) {
            triggerSuccessStep();
          } else {
            drawError.style.display = 'block';
            canvasWrap.removeAttribute('data-match-level');
          }
        }
      }, 10000);
    }

    function evaluateCurrentDrawing() {
      var flatPoints = [];
      strokes.forEach(function(s) { flatPoints = flatPoints.concat(s); });
      if (flatPoints.length < 10) {
        canvasWrap.removeAttribute('data-match-level');
        return;
      }

      var matchScore = evaluateShapeScore(flatPoints, canvas.width, canvas.height);

      if (matchScore >= 0.70) {
        canvasWrap.setAttribute('data-match-level', '3');
        // High accuracy — trigger transition instantly
        setTimeout(triggerSuccessStep, 300);
      } else if (matchScore >= 0.45) {
        canvasWrap.setAttribute('data-match-level', '2');
      } else if (matchScore >= 0.25) {
        canvasWrap.setAttribute('data-match-level', '1');
      } else {
        canvasWrap.removeAttribute('data-match-level');
      }
    }

    function triggerSuccessStep() {
      if (septInterval) clearInterval(septInterval);
      if (septInactivityTimer) clearTimeout(septInactivityTimer);
      
      document.getElementById('sept-step-3').classList.remove('is-active');
      document.getElementById('sept-step-4').classList.add('is-active');
      runFinalParticleSequence();
    }

    document.getElementById('sept-canvas-undo').addEventListener('click', function() {
      if(strokes.length > 0) {
        redoStrokes.push(strokes.pop());
        redrawCanvas();
        drawError.style.display = 'none';
        evaluateCurrentDrawing();
      }
    });

    document.getElementById('sept-canvas-redo').addEventListener('click', function() {
      if(redoStrokes.length > 0) {
        strokes.push(redoStrokes.pop());
        redrawCanvas();
        drawError.style.display = 'none';
        evaluateCurrentDrawing();
      }
    });

    document.getElementById('sept-canvas-clear').addEventListener('click', function() {
      strokes = [];
      redoStrokes = [];
      redrawCanvas();
      drawError.style.display = 'none';
      canvasWrap.removeAttribute('data-match-level');
    });
  }

  /* ---------- ROBUST OCR SHAPE RECOGNITION ALGORITHM ---------- */
  function evaluateShapeScore(pointsArray, cWidth, cHeight) {
    if (!pointsArray || pointsArray.length < 12) return 0;

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pointsArray.forEach(function(p) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    var w = maxX - minX, h = maxY - minY;
    // Minimum dimensions requirement
    if (w < cWidth * 0.20 || h < cHeight * 0.20) return 0;

    // 10x10 Grid for spatial evaluation
    var GRID_SIZE = 10;
    var grid = [];
    for (var i = 0; i < GRID_SIZE; i++) {
      var row = [];
      for (var j = 0; j < GRID_SIZE; j++) row.push(0);
      grid.push(row);
    }

    pointsArray.forEach(function(p) {
      var gx = Math.floor(((p.x - minX) / w) * (GRID_SIZE - 0.01));
      var gy = Math.floor(((p.y - minY) / h) * (GRID_SIZE - 0.01));
      grid[gy][gx] = 1;
    });

    var totalFilled = 0;
    var topRay = 0, bottomRay = 0, leftRay = 0, rightRay = 0;
    var centerZone = 0, innerEyeZone = 0;

    for (var y = 0; y < GRID_SIZE; y++) {
      for (var x = 0; x < GRID_SIZE; x++) {
        if (grid[y][x] === 1) {
          totalFilled++;
          // Top and bottom rays
          if (y <= 2 && x >= 3 && x <= 6) topRay++;
          if (y >= 7 && x >= 3 && x <= 6) bottomRay++;
          // Left and right rays
          if (x <= 2 && y >= 3 && y <= 6) leftRay++;
          if (x >= 7 && y >= 3 && y <= 6) rightRay++;
          // Central area (eye / oval)
          if (y >= 3 && y <= 6 && x >= 2 && x <= 7) centerZone++;
          // Inner eye core
          if (y >= 4 && y <= 5 && x >= 3 && x <= 6) innerEyeZone++;
        }
      }
    }

    // Protection against scribbling the entire canvas
    if (totalFilled > 62) return 0;

    // Calculate score match
    var score = 0;

    // 1. External rays presence (4 rays)
    if (topRay >= 1) score += 0.20;
    if (bottomRay >= 1) score += 0.20;
    if (leftRay >= 1) score += 0.15;
    if (rightRay >= 1) score += 0.15;

    // 2. Center oval/eye structure
    if (centerZone >= 3) score += 0.15;
    if (innerEyeZone >= 1) score += 0.15;

    // 3. Aspect ratio close to square
    var aspectRatio = w / (h || 1);
    if (aspectRatio >= 0.7 && aspectRatio <= 1.4) {
      score += 0.10;
    }

    return Math.min(score, 1.0);
  }

  /* ---------- 6. FINAL ANIMATION & PARTICLES ---------- */
  function runFinalParticleSequence() {
    var img = document.getElementById('sept-gold-img');
    var pCanvas = document.getElementById('sept-particles-canvas');
    var rememberText = document.getElementById('sept-remember');
    var wrap = document.getElementById('sept-final-wrap');

    if (!img || !pCanvas || !wrap) return;

    var ctx = pCanvas.getContext('2d');
    var width = pCanvas.width = wrap.clientWidth || 300;
    var height = pCanvas.height = wrap.clientHeight || 300;

    // Step 1: Reveal gold symbol image
    setTimeout(function() {
      img.classList.add('is-visible');
    }, 100);

    // Step 2 & 3: Symbol dissolves and breaks into particles
    setTimeout(function() {
      img.style.opacity = '0';
      img.style.transform = 'scale(1.1) blur(6px)';

      createParticleExplosion(ctx, width, height, function() {
        // Step 4, 5, 6: Particles form letter S and fade away
        setTimeout(function() {
          // Step 7: Fade in "Remember it."
          rememberText.classList.add('is-visible');

          // Auto-complete quest after 3.5 seconds
          setTimeout(function() {
            if (activeModalQuestId) {
              markCompleted(activeModalQuestId);
              closeQuestModal();
              renderGridContent(currentIndex);
            }
          }, 3500);
        }, 1200);
      });
    }, 2400);
  }

  function createParticleExplosion(ctx, w, h, onComplete) {
    var particles = [];
    var count = 180;
    var centerX = w / 2;
    var centerY = h / 2 - 10;

    // Generate points forming letter S
    var sPoints = [];
    for (var t = 0; t <= Math.PI * 2; t += 0.035) {
      var x = Math.sin(t) * 38;
      var y = -Math.sin(t * 2) * 45;
      sPoints.push({ x: centerX + x, y: centerY + y });
    }

    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = Math.random() * 6 + 2;
      var target = sPoints[i % sPoints.length];

      particles.push({
        x: centerX + (Math.random() - 0.5) * 80,
        y: centerY + (Math.random() - 0.5) * 80,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        targetX: target.x + (Math.random() - 0.5) * 6,
        targetY: target.y + (Math.random() - 0.5) * 6,
        size: Math.random() * 2.5 + 1.2,
        color: Math.random() > 0.3 ? '#ebd48f' : '#ffffff',
        alpha: 1,
        state: 'explode' // 'explode' -> 'gather' -> 'fade'
      });
    }

    var startTime = performance.now();

    function animate(time) {
      var elapsed = time - startTime;
      ctx.clearRect(0, 0, w, h);

      var allDone = true;

      particles.forEach(function(p) {
        if (p.state === 'explode') {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.92;
          p.vy *= 0.92;

          if (elapsed > 600) {
            p.state = 'gather';
          }
        } else if (p.state === 'gather') {
          p.x += (p.targetX - p.x) * 0.08;
          p.y += (p.targetY - p.y) * 0.08;

          if (elapsed > 2600) {
            p.state = 'fade';
          }
        } else if (p.state === 'fade') {
          p.alpha -= 0.02;
          if (p.alpha < 0) p.alpha = 0;
        }

        if (p.alpha > 0) {
          allDone = false;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ebd48f';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      if (!allDone) {
        requestAnimationFrame(animate);
      } else {
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(animate);
  }


  /* ---------- 7. MODAL ---------- */
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
        defaultText.textContent = 'Задание открыто. Исследуйте подсказки этого дня и отметьте этап пройденным после выполнения. Желаем огромного успеха!';
        modalCompleteBtn.textContent = 'Отметить пройденным';
        modalCompleteBtn.removeAttribute('disabled');
      }
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeQuestModal() {
    if (septInterval) clearInterval(septInterval);
    if (septInactivityTimer) clearTimeout(septInactivityTimer);
    
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

  /* ---------- INIT ---------- */
  renderGridContent(0);

})();
