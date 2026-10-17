(function () {
  'use strict';

  /* ---------- ТЕМА ---------- */
  var THEME_KEY = 'legrot-theme';
  var root = document.documentElement;
  var themeToggle = document.getElementById('themeToggle');

  function applyTheme(t) { root.setAttribute('data-theme', t); }
  function getSavedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  function saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }

  var saved = getSavedTheme();
  applyTheme(saved === 'dark' ? 'dark' : 'light');

  themeToggle.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    saveTheme(next);
    if (typeof runCalculation === 'function') { runCalculation(); }
  });

  var yearEl = document.getElementById('footerYear');
  if (yearEl) { yearEl.textContent = String(new Date().getFullYear()); }

  /* ---------- УТИЛИТЫ ---------- */
  function formatMoney(v) {
    if (!isFinite(v)) return '—';
    return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
  }

  function formatMoneyShort(v) {
    if (!isFinite(v)) return '—';
    var abs = Math.abs(v);
    if (abs >= 1e9) return (v / 1e9).toFixed(2) + ' млрд';
    if (abs >= 1e6) return (v / 1e6).toFixed(2) + ' млн';
    if (abs >= 1e3) return (v / 1e3).toFixed(1) + ' тыс';
    return v.toFixed(0);
  }

  function isPositive(n) { return !isNaN(n) && isFinite(n) && n > 0; }
  function isNonNegative(n) { return !isNaN(n) && isFinite(n) && n >= 0; }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ---------- КОНФИГ КАЛЬКУЛЯТОРОВ ---------- */
  var CALCS = {
    deposit: {
      title: 'Вклад',
      eyebrow: 'Deposit',
      desc: 'Итоговая сумма вклада с простыми процентами за указанный срок.',
      fields: [
        { id: 'sum', label: 'Сумма вклада, ₽', type: 'number', step: 'any', value: '100000', placeholder: 'Например 100000' },
        { id: 'rate', label: 'Годовая ставка, %', type: 'number', step: '0.1', value: '8', placeholder: 'Например 8' },
        { id: 'months', label: 'Срок, месяцев', type: 'number', step: '1', value: '12', placeholder: 'Например 12' }
      ],
      compute: function (v) {
        if (!isPositive(v.sum)) return { error: 'Сумма вклада должна быть больше нуля.' };
        if (!isNonNegative(v.rate)) return { error: 'Ставка не может быть отрицательной.' };
        if (!isPositive(v.months)) return { error: 'Срок должен быть больше нуля месяцев.' };
        var years = v.months / 12;
        var interest = v.sum * (v.rate / 100) * years;
        var total = v.sum + interest;
        var points = [];
        var steps = 24;
        for (var i = 0; i <= steps; i++) {
          var t = (i / steps) * years;
          points.push({ x: t, y: v.sum + v.sum * (v.rate / 100) * t });
        }
        return {
          value: formatMoney(total),
          note: 'Проценты за срок: ' + formatMoney(interest),
          stats: [
            { label: 'Вложено', value: formatMoney(v.sum) },
            { label: 'Проценты', value: formatMoney(interest) },
            { label: 'Итого', value: formatMoney(total) },
            { label: 'Доходность', value: (years > 0 ? (interest / v.sum / years * 100).toFixed(1) : '0') + '% год.' }
          ],
          chart: { points: points, xLabel: 'Годы', yLabel: 'Сумма, ₽', marker: { x: years, y: total } }
        };
      }
    },

    compound: {
      title: 'Сложный процент',
      eyebrow: 'Compound',
      desc: 'Стартовый капитал + регулярные пополнения, капитализация и инфляция.',
      fields: [
        { id: 'principal', label: 'Стартовый капитал, ₽', type: 'number', step: 'any', value: '100000', placeholder: 'Например 100000' },
        { id: 'monthly', label: 'Ежемесячное пополнение, ₽', type: 'number', step: 'any', value: '10000', placeholder: 'Например 10000' },
        { id: 'rate', label: 'Годовая ставка, %', type: 'number', step: '0.1', value: '12', placeholder: 'Например 12' },
        { id: 'years', label: 'Срок, лет', type: 'number', step: '0.5', value: '5', placeholder: 'Например 5' },
        { id: 'inflation', label: 'Инфляция, % в год', type: 'number', step: '0.1', value: '4', placeholder: 'Например 4' },
        { id: 'capitalization', label: 'Капитализация', type: 'select', value: 'monthly',
          options: [
            { value: 'monthly', label: 'Ежемесячно' },
            { value: 'quarterly', label: 'Ежеквартально' },
            { value: 'annually', label: 'Ежегодно' }
          ]
        }
      ],
      compute: function (v) {
        if (!isNonNegative(v.principal)) return { error: 'Стартовый капитал не может быть отрицательным.' };
        if (!isNonNegative(v.monthly)) return { error: 'Пополнение не может быть отрицательным.' };
        if (!isNonNegative(v.rate)) return { error: 'Ставка не может быть отрицательной.' };
        if (!isPositive(v.years)) return { error: 'Срок должен быть больше нуля лет.' };
        if (!isNonNegative(v.inflation)) return { error: 'Инфляция не может быть отрицательной.' };

        var periods = v.capitalization === 'monthly' ? 12 : (v.capitalization === 'quarterly' ? 4 : 1);
        var totalMonths = Math.round(v.years * 12);
        var ratePerPeriod = v.rate / 100 / periods;

        var balance = v.principal;
        var contributed = v.principal;
        for (var m = 0; m < totalMonths; m++) {
          if (m > 0) { balance += v.monthly; contributed += v.monthly; }
          if ((m + 1) % (12 / periods) === 0) balance *= (1 + ratePerPeriod);
        }
        var real = balance / Math.pow(1 + v.inflation / 100, v.years);
        var interest = balance - contributed;

        var points = [];
        var steps = 40;
        for (var i = 0; i <= steps; i++) {
          var t = (i / steps) * v.years;
          var months = Math.round(t * 12);
          var b = v.principal, c = v.principal;
          for (var mm = 0; mm < months; mm++) {
            if (mm > 0) { b += v.monthly; c += v.monthly; }
            if ((mm + 1) % (12 / periods) === 0) b *= (1 + ratePerPeriod);
          }
          points.push({ x: t, y: b, y2: c, y3: b / Math.pow(1 + v.inflation / 100, t) });
        }

        return {
          value: formatMoney(balance),
          note: 'Внесено: ' + formatMoney(contributed) + ' · Проценты: ' + formatMoney(interest) + ' · Реально: ' + formatMoney(real),
          stats: [
            { label: 'Внесено', value: formatMoney(contributed) },
            { label: 'Проценты', value: formatMoney(interest) },
            { label: 'Номинал', value: formatMoney(balance) },
            { label: 'Реально', value: formatMoney(real) }
          ],
          chart: {
            points: points, xLabel: 'Годы', yLabel: 'Капитал, ₽',
            legend: [
              { color: 'accent-2', label: 'Внесено' },
              { color: 'accent', label: 'Номинал' },
              { color: 'accent-3', label: 'Реальная стоимость' }
            ],
            marker: { x: v.years, y: balance }
          }
        };
      }
    },

    when: {
      title: 'Когда накоплю?',
      eyebrow: 'Goal',
      desc: 'Сколько времени нужно, чтобы накопить целевую сумму при регулярных взносах?',
      fields: [
        { id: 'target', label: 'Цель, ₽', type: 'number', step: 'any', value: '1000000', placeholder: 'Например 1000000' },
        { id: 'principal', label: 'Стартовый капитал, ₽', type: 'number', step: 'any', value: '100000', placeholder: 'Например 100000' },
        { id: 'monthly', label: 'Ежемесячный взнос, ₽', type: 'number', step: 'any', value: '15000', placeholder: 'Например 15000' },
        { id: 'rate', label: 'Годовая ставка, %', type: 'number', step: '0.1', value: '12', placeholder: 'Например 12' },
        { id: 'inflation', label: 'Инфляция, % в год', type: 'number', step: '0.1', value: '4', placeholder: 'Например 4' }
      ],
      compute: function (v) {
        if (!isPositive(v.target)) return { error: 'Цель должна быть больше нуля.' };
        if (!isNonNegative(v.principal)) return { error: 'Стартовый капитал не может быть отрицательным.' };
        if (!isNonNegative(v.monthly)) return { error: 'Взнос не может быть отрицательным.' };
        if (!isNonNegative(v.rate)) return { error: 'Ставка не может быть отрицательной.' };
        if (!isNonNegative(v.inflation)) return { error: 'Инфляция не может быть отрицательной.' };

        var monthlyRate = v.rate / 100 / 12;
        var MAX_MONTHS = 12 * 60;
        var balance = v.principal;
        var found = -1;
        for (var m = 0; m < MAX_MONTHS; m++) {
          if (m > 0) balance += v.monthly;
          balance *= (1 + monthlyRate);
          var targetNow = v.inflation > 0 ? v.target * Math.pow(1 + v.inflation / 100, (m + 1) / 12) : v.target;
          if (balance >= targetNow) { found = m + 1; break; }
        }
        if (found < 0) return { error: 'Цель не достигнута за 60 лет. Увеличьте взнос или ставку.' };

        var years = found / 12;
        var contributed = v.principal + v.monthly * (found - 1);
        var targetFinal = v.inflation > 0 ? v.target * Math.pow(1 + v.inflation / 100, years) : v.target;

        var points = [];
        var steps = 40;
        var totalYears = years * 1.15;
        for (var i = 0; i <= steps; i++) {
          var t = (i / steps) * totalYears;
          var months = Math.round(t * 12);
          var b = v.principal, c = v.principal;
          for (var mm = 0; mm < months; mm++) {
            if (mm > 0) { b += v.monthly; c += v.monthly; }
            b *= (1 + monthlyRate);
          }
          var targetLine = v.inflation > 0 ? v.target * Math.pow(1 + v.inflation / 100, t) : v.target;
          points.push({ x: t, y: b, y2: c, y3: targetLine });
        }

        return {
          value: years.toFixed(1) + ' лет (' + found + ' мес.)',
          note: 'Цель: ' + formatMoney(targetFinal) + ' · Внесено: ' + formatMoney(contributed) + ' · Капитал: ' + formatMoney(balance),
          stats: [
            { label: 'Срок', value: years.toFixed(1) + ' лет' },
            { label: 'Месяцев', value: found + ' мес.' },
            { label: 'Внесено', value: formatMoney(contributed) },
            { label: 'Итог', value: formatMoney(balance) }
          ],
          chart: {
            points: points, xLabel: 'Годы', yLabel: 'Капитал, ₽',
            legend: [
              { color: 'accent-2', label: 'Внесено' },
              { color: 'accent', label: 'Накоплено' },
              { color: 'error', label: 'Цель с инфляцией' }
            ],
            marker: { x: years, y: balance }
          }
        };
      }
    },

    loan: {
      title: 'Кредит',
      eyebrow: 'Loan',
      desc: 'Аннуитетный ежемесячный платёж и общая переплата по кредиту.',
      fields: [
        { id: 'amount', label: 'Сумма кредита, ₽', type: 'number', step: 'any', value: '300000', placeholder: 'Например 300000' },
        { id: 'rate', label: 'Годовая ставка, %', type: 'number', step: '0.1', value: '14', placeholder: 'Например 14' },
        { id: 'months', label: 'Срок, месяцев', type: 'number', step: '1', value: '24', placeholder: 'Например 24' }
      ],
      compute: function (v) {
        if (!isPositive(v.amount)) return { error: 'Сумма кредита должна быть больше нуля.' };
        if (!isNonNegative(v.rate)) return { error: 'Ставка не может быть отрицательной.' };
        if (!isPositive(v.months)) return { error: 'Срок должен быть больше нуля месяцев.' };
        var mr = v.rate / 100 / 12;
        var payment;
        if (mr === 0) payment = v.amount / v.months;
        else { var pow = Math.pow(1 + mr, v.months); payment = v.amount * mr * pow / (pow - 1); }
        var total = payment * v.months;
        var overpay = total - v.amount;
        var points = [];
        var remaining = v.amount;
        points.push({ x: 0, y: remaining });
        for (var i = 1; i <= v.months; i++) {
          remaining = remaining * (1 + mr) - payment;
          if (remaining < 0) remaining = 0;
          points.push({ x: i, y: remaining });
        }
        return {
          value: formatMoney(payment) + ' / мес.',
          note: 'Переплата: ' + formatMoney(overpay) + ' · Всего: ' + formatMoney(total),
          stats: [
            { label: 'Платёж', value: formatMoney(payment) },
            { label: 'Переплата', value: formatMoney(overpay) },
            { label: 'Всего', value: formatMoney(total) },
            { label: 'Срок', value: v.months + ' мес.' }
          ],
          chart: { points: points, xLabel: 'Месяцы', yLabel: 'Остаток долга, ₽', marker: { x: v.months, y: 0 } }
        };
      }
    },

    mortgage: {
      title: 'Ипотека',
      eyebrow: 'Mortgage',
      desc: 'Ежемесячный платёж и переплата по ипотеке на заданный срок.',
      fields: [
        { id: 'amount', label: 'Сумма ипотеки, ₽', type: 'number', step: 'any', value: '4000000', placeholder: 'Например 4000000' },
        { id: 'rate', label: 'Годовая ставка, %', type: 'number', step: '0.1', value: '9', placeholder: 'Например 9' },
        { id: 'years', label: 'Срок, лет', type: 'number', step: '1', value: '20', placeholder: 'Например 20' }
      ],
      compute: function (v) {
        if (!isPositive(v.amount)) return { error: 'Сумма ипотеки должна быть больше нуля.' };
        if (!isNonNegative(v.rate)) return { error: 'Ставка не может быть отрицательной.' };
        if (!isPositive(v.years)) return { error: 'Срок должен быть больше нуля лет.' };
        var months = Math.round(v.years * 12);
        var mr = v.rate / 100 / 12;
        var payment;
        if (mr === 0) payment = v.amount / months;
        else { var pow = Math.pow(1 + mr, months); payment = v.amount * mr * pow / (pow - 1); }
        var total = payment * months;
        var overpay = total - v.amount;
        var points = [];
        var steps = 60;
        for (var i = 0; i <= steps; i++) {
          var m = Math.round((i / steps) * months);
          var rem;
          if (mr === 0) rem = v.amount - payment * m;
          else rem = v.amount * Math.pow(1 + mr, m) - payment * ((Math.pow(1 + mr, m) - 1) / mr);
          if (rem < 0) rem = 0;
          points.push({ x: m / 12, y: rem });
        }
        return {
          value: formatMoney(payment) + ' / мес.',
          note: 'Переплата: ' + formatMoney(overpay) + ' · Всего: ' + formatMoney(total),
          stats: [
            { label: 'Платёж', value: formatMoney(payment) },
            { label: 'Переплата', value: formatMoney(overpay) },
            { label: 'Всего', value: formatMoney(total) },
            { label: 'Срок', value: v.years + ' лет' }
          ],
          chart: { points: points, xLabel: 'Годы', yLabel: 'Остаток долга, ₽', marker: { x: v.years, y: 0 } }
        };
      }
    },

    savings: {
      title: 'Накопления',
      eyebrow: 'Savings',
      desc: 'Будущая стоимость регулярных ежемесячных взносов под процент.',
      fields: [
        { id: 'monthly', label: 'Ежемесячный взнос, ₽', type: 'number', step: 'any', value: '10000', placeholder: 'Например 10000' },
        { id: 'rate', label: 'Годовая ставка, %', type: 'number', step: '0.1', value: '7', placeholder: 'Например 7' },
        { id: 'years', label: 'Срок, лет', type: 'number', step: '1', value: '10', placeholder: 'Например 10' }
      ],
      compute: function (v) {
        if (!isPositive(v.monthly)) return { error: 'Ежемесячный взнос должен быть больше нуля.' };
        if (!isNonNegative(v.rate)) return { error: 'Ставка не может быть отрицательной.' };
        if (!isPositive(v.years)) return { error: 'Срок должен быть больше нуля лет.' };
        var months = Math.round(v.years * 12);
        var mr = v.rate / 100 / 12;
        var total;
        if (mr === 0) total = v.monthly * months;
        else total = v.monthly * (Math.pow(1 + mr, months) - 1) / mr;
        var invested = v.monthly * months;
        var profit = total - invested;
        var points = [];
        var steps = 40;
        for (var i = 0; i <= steps; i++) {
          var m = Math.round((i / steps) * months);
          var val;
          if (mr === 0) val = v.monthly * m;
          else val = v.monthly * (Math.pow(1 + mr, m) - 1) / mr;
          points.push({ x: m / 12, y: val });
        }
        return {
          value: formatMoney(total),
          note: 'Вложено: ' + formatMoney(invested) + ' · Доход: ' + formatMoney(profit),
          stats: [
            { label: 'Внесено', value: formatMoney(invested) },
            { label: 'Доход', value: formatMoney(profit) },
            { label: 'Итог', value: formatMoney(total) },
            { label: 'Срок', value: v.years + ' лет' }
          ],
          chart: { points: points, xLabel: 'Годы', yLabel: 'Накопления, ₽', marker: { x: v.years, y: total } }
        };
      }
    },

    inflation: {
      title: 'Инфляция',
      eyebrow: 'Inflation',
      desc: 'Реальная покупательная способность суммы через N лет.',
      fields: [
        { id: 'amount', label: 'Текущая сумма, ₽', type: 'number', step: 'any', value: '100000', placeholder: 'Например 100000' },
        { id: 'rate', label: 'Годовая инфляция, %', type: 'number', step: '0.1', value: '6', placeholder: 'Например 6' },
        { id: 'years', label: 'Период, лет', type: 'number', step: '1', value: '5', placeholder: 'Например 5' }
      ],
      compute: function (v) {
        if (!isPositive(v.amount)) return { error: 'Сумма должна быть больше нуля.' };
        if (!isNonNegative(v.rate)) return { error: 'Инфляция не может быть отрицательной.' };
        if (!isPositive(v.years)) return { error: 'Период должен быть больше нуля лет.' };
        var real = v.amount / Math.pow(1 + v.rate / 100, v.years);
        var loss = v.amount - real;
        var points = [];
        var steps = 30;
        for (var i = 0; i <= steps; i++) {
          var t = (i / steps) * v.years;
          points.push({ x: t, y: v.amount / Math.pow(1 + v.rate / 100, t) });
        }
        return {
          value: formatMoney(real),
          note: 'Потери: ' + formatMoney(loss),
          stats: [
            { label: 'Сейчас', value: formatMoney(v.amount) },
            { label: 'Через ' + v.years + ' лет', value: formatMoney(real) },
            { label: 'Потери', value: formatMoney(loss) },
            { label: 'Инфляция', value: v.rate + '% год.' }
          ],
          chart: { points: points, xLabel: 'Годы', yLabel: 'Реальная стоимость, ₽', marker: { x: v.years, y: real } }
        };
      }
    },

    tax: {
      title: 'Налоги',
      eyebrow: 'Tax',
      desc: 'Расчёт налогов для разных режимов: НДФЛ, УСН, ИП, самозанятый.',
      fields: [
        { id: 'income', label: 'Доход за год, ₽', type: 'number', step: 'any', value: '1200000', placeholder: 'Например 1200000' },
        { id: 'expenses', label: 'Расходы (для УСН 15%), ₽', type: 'number', step: 'any', value: '700000', placeholder: 'Например 700000' },
        { id: 'regime', label: 'Налоговый режим', type: 'select', value: 'ndfl',
          options: [
            { value: 'ndfl', label: 'НДФЛ 13%' },
            { value: 'usn6', label: 'УСН «Доходы» 6%' },
            { value: 'usn15', label: 'УСН «Доходы минус расходы» 15%' },
            { value: 'ip_ndfl', label: 'ИП на НДФЛ 13%' },
            { value: 'self', label: 'Самозанятый 6%' },
            { value: 'patent', label: 'Патент (потенц. доход)' }
          ]
        },
        { id: 'potential', label: 'Потенциальный доход (патент), ₽', type: 'number', step: 'any', value: '600000', placeholder: 'Например 600000' }
      ],
      compute: function (v) {
        if (!isPositive(v.income)) return { error: 'Доход должен быть больше нуля.' };
        if (!isNonNegative(v.expenses)) return { error: 'Расходы не могут быть отрицательными.' };
        if (!isNonNegative(v.potential)) return { error: 'Потенциальный доход не может быть отрицательным.' };

        var tax = 0, label = '', note = '';
        switch (v.regime) {
          case 'ndfl':
            tax = v.income * 0.13; label = 'НДФЛ 13%';
            note = 'На руки: ' + formatMoney(v.income - tax); break;
          case 'usn6':
            tax = v.income * 0.06; label = 'УСН «Доходы» 6%';
            note = 'На руки: ' + formatMoney(v.income - tax); break;
          case 'usn15':
            var base = Math.max(0, v.income - v.expenses);
            tax = base * 0.15; label = 'УСН «Д−Р» 15%';
            note = 'База: ' + formatMoney(base) + ' · На руки: ' + formatMoney(v.income - tax); break;
          case 'ip_ndfl':
            tax = v.income * 0.13; label = 'ИП на НДФЛ 13%';
            note = 'На руки: ' + formatMoney(v.income - tax) + ' (без учёта взносов)'; break;
          case 'self':
            tax = v.income * 0.06; label = 'Самозанятый 6%';
            note = 'На руки: ' + formatMoney(v.income - tax); break;
          case 'patent':
            tax = v.potential * 0.06; label = 'Патент (6% от потенц. дохода)';
            note = 'Потенц. доход: ' + formatMoney(v.potential) + ' · На руки (условно): ' + formatMoney(v.income - tax); break;
        }
        var net = v.income - tax;
        return {
          value: formatMoney(tax),
          note: label + ' · ' + note,
          stats: [
            { label: 'Режим', value: label },
            { label: 'Доход', value: formatMoney(v.income) },
            { label: 'Налог', value: formatMoney(tax) },
            { label: 'На руки', value: formatMoney(net) }
          ],
          chart: {
            points: [{ x: 0, y: 0 }, { x: 1, y: v.income }, { x: 2, y: tax }],
            xLabel: 'Налог и доход', yLabel: 'Сумма, ₽',
            bar: [
              { label: 'На руки', value: net, color: 'accent' },
              { label: 'Налог', value: tax, color: 'accent-3' }
            ],
            marker: { x: 2, y: tax }
          }
        };
      }
    },

    commission: {
      title: 'Комиссии',
      eyebrow: 'Commission',
      desc: 'Итоговая сумма с учётом комиссии и размер самой комиссии.',
      fields: [
        { id: 'amount', label: 'Сумма, ₽', type: 'number', step: 'any', value: '5000', placeholder: 'Например 5000' },
        { id: 'rate', label: 'Комиссия, %', type: 'number', step: '0.1', value: '3', placeholder: 'Например 3' }
      ],
      compute: function (v) {
        if (!isPositive(v.amount)) return { error: 'Сумма должна быть больше нуля.' };
        if (!isNonNegative(v.rate)) return { error: 'Комиссия не может быть отрицательной.' };
        var commission = v.amount * v.rate / 100;
        var total = v.amount + commission;
        return {
          value: formatMoney(total),
          note: 'Комиссия: ' + formatMoney(commission),
          stats: [
            { label: 'База', value: formatMoney(v.amount) },
            { label: 'Комиссия', value: formatMoney(commission) },
            { label: 'Итого', value: formatMoney(total) },
            { label: 'Ставка', value: v.rate + '%' }
          ],
          chart: {
            points: [{ x: 0, y: 0 }, { x: 1, y: v.amount }, { x: 2, y: total }],
            xLabel: 'База и комиссия', yLabel: 'Сумма, ₽',
            bar: [
              { label: 'База', value: v.amount, color: 'accent' },
              { label: 'Комиссия', value: commission, color: 'accent-3' }
            ],
            marker: { x: 2, y: total }
          }
        };
      }
    }
  };

  /* ---------- DOM ---------- */
  var panelFields = document.getElementById('panelFields');
  var panelTitle = document.getElementById('panelTitle');
  var panelDesc = document.getElementById('panelDesc');
  var panelEyebrow = document.getElementById('panelEyebrow');
  var panelCalcBtn = document.getElementById('panelCalcBtn');
  var panelResult = document.getElementById('panelResult');
  var panelStats = document.getElementById('panelStats');
  var chartWrap = document.getElementById('chartWrap');
  var chartSvg = document.getElementById('chartSvg');
  var chartLegend = document.getElementById('chartLegend');

  var currentKey = 'deposit';

  function renderFields(key) {
    var cfg = CALCS[key];
    panelFields.innerHTML = '';
    var rowBuffer = [];

    function buildLabel(f) {
      var label = document.createElement('label');
      label.className = 'field__label';
      label.setAttribute('for', 'field-' + f.id);
      label.textContent = f.label;
      return label;
    }

    function buildInput(f) {
      var input = document.createElement('input');
      input.className = 'field__input';
      input.type = f.type;
      input.id = 'field-' + f.id;
      input.name = f.id;
      input.step = f.step || 'any';
      input.value = f.value || '';
      input.placeholder = f.placeholder || '';
      input.setAttribute('inputmode', 'decimal');
      return input;
    }

    function flushRow() {
      if (rowBuffer.length === 1) {
        var f = rowBuffer[0];
        var wrap = document.createElement('div');
        wrap.className = 'field';
        wrap.appendChild(buildLabel(f));
        wrap.appendChild(buildInput(f));
        panelFields.appendChild(wrap);
      } else {
        var row = document.createElement('div');
        row.className = 'field__row';
        rowBuffer.forEach(function (f) {
          var wrap = document.createElement('div');
          wrap.className = 'field';
          wrap.appendChild(buildLabel(f));
          wrap.appendChild(buildInput(f));
          row.appendChild(wrap);
        });
        panelFields.appendChild(row);
      }
      rowBuffer = [];
    }

    cfg.fields.forEach(function (f) {
      if (f.type === 'select') {
        if (rowBuffer.length) flushRow();
        var wrap = document.createElement('div');
        wrap.className = 'field';
        wrap.appendChild(buildLabel(f));
        var sel = document.createElement('select');
        sel.className = 'field__select';
        sel.id = 'field-' + f.id;
        sel.name = f.id;
        f.options.forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.label;
          if (o.value === f.value) opt.selected = true;
          sel.appendChild(opt);
        });
        wrap.appendChild(sel);
        panelFields.appendChild(wrap);
      } else {
        rowBuffer.push(f);
        if (rowBuffer.length === 2) flushRow();
      }
    });
    if (rowBuffer.length) flushRow();
  }

  function readValues(key) {
    var cfg = CALCS[key];
    var values = {};
    cfg.fields.forEach(function (f) {
      var el = document.getElementById('field-' + f.id);
      if (!el) { values[f.id] = NaN; return; }
      if (f.type === 'select') { values[f.id] = el.value; }
      else {
        var raw = String(el.value).trim();
        values[f.id] = raw === '' ? NaN : Number(raw);
      }
    });
    return values;
  }

  /* ---------- ТУЛТИП ---------- */
  var chartTooltip = null;

  function ensureTooltip() {
    if (chartTooltip) return chartTooltip;
    chartTooltip = document.createElement('div');
    chartTooltip.className = 'chart-tooltip';
    chartWrap.appendChild(chartTooltip);
    return chartTooltip;
  }

  /* ---------- ГРАФИК ---------- */
  function drawChart(chart) {
    var tip = ensureTooltip();
    tip.classList.remove('is-visible');

    if (!chart) { chartSvg.innerHTML = ''; chartLegend.innerHTML = ''; return; }

    var W = 600, H = 380;
    var padL = 70, padR = 30, padT = 30, padB = 50;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;

    var accent = cssVar('--accent');
    var accent2 = cssVar('--accent-2');
    var accent3 = cssVar('--accent-3');
    var errorColor = cssVar('--error');
    var border = cssVar('--border-strong');
    var textSoft = cssVar('--text-soft');
    var textMuted = cssVar('--text-muted');
    var surface = cssVar('--surface-solid');

    function colorFor(name) {
      if (name === 'accent-2') return accent2;
      if (name === 'accent-3') return accent3;
      if (name === 'error') return errorColor;
      return accent;
    }

    var svg = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="transparent"/>';

    if (chart.legend) {
      chartLegend.innerHTML = chart.legend.map(function (l) {
        return '<span><i style="background:' + colorFor(l.color) + '"></i>' + l.label + '</span>';
      }).join('');
    } else {
      chartLegend.innerHTML = '';
    }

    /* --- столбцы --- */
    if (chart.bar) {
      var barData = chart.bar;
      var barMax = Math.max.apply(null, barData.map(function (b) { return Math.abs(b.value); }));
      if (barMax === 0) barMax = 1;
      var gap = 50;
      var barW = Math.min(140, (innerW - gap * (barData.length + 1)) / barData.length);
      var totalW = barW * barData.length + gap * (barData.length - 1);
      var startX = padL + (innerW - totalW) / 2;

      svg += '<line x1="' + padL + '" y1="' + (padT + innerH) + '" x2="' + (padL + innerW) + '" y2="' + (padT + innerH) + '" stroke="' + border + '" stroke-width="1"/>';

      barData.forEach(function (b, i) {
        var h = (Math.abs(b.value) / barMax) * innerH;
        var x = startX + i * (barW + gap);
        var y = padT + innerH - h;
        var col = colorFor(b.color || 'accent');
        svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" rx="10" fill="' + col + '" opacity="0.85"/>';
        svg += '<text x="' + (x + barW / 2) + '" y="' + (padT + innerH + 22) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="' + textMuted + '" letter-spacing="0.06em">' + b.label + '</text>';
        svg += '<text x="' + (x + barW / 2) + '" y="' + (y - 8) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="600" fill="' + textMuted + '">' + formatMoneyShort(b.value) + '</text>';
      });

      chartSvg.innerHTML = svg;
      chartWrap.classList.add('has-data');
      return;
    }

    if (!chart.points || chart.points.length < 2) {
      chartSvg.innerHTML = '';
      chartWrap.classList.remove('has-data');
      return;
    }

    var xs = chart.points.map(function (p) { return p.x; });
    var allY = [];
    chart.points.forEach(function (p) {
      if (p.y !== undefined) allY.push(p.y);
      if (p.y2 !== undefined) allY.push(p.y2);
      if (p.y3 !== undefined) allY.push(p.y3);
    });
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    var maxY = Math.max.apply(null, allY);
    if (maxY === 0) maxY = 1;
    if (maxX === minX) maxX = minX + 1;

    function sx(x) { return padL + ((x - minX) / (maxX - minX)) * innerW; }
    function sy(y) { return padT + innerH - (y / maxY) * innerH; }

    /* --- сетка --- */
    var gridCount = 4;
    for (var g = 0; g <= gridCount; g++) {
      var gy = padT + (innerH / gridCount) * g;
      var gv = maxY - maxY * (g / gridCount);
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (padL + innerW) + '" y2="' + gy + '" stroke="' + border + '" stroke-width="1" stroke-dasharray="3 5"/>';
      svg += '<text x="' + (padL - 10) + '" y="' + (gy + 4) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="11" fill="' + textSoft + '">' + formatMoneyShort(gv) + '</text>';
    }

    var xTicks = 5;
    for (var t = 0; t <= xTicks; t++) {
      var tx = minX + (maxX - minX) * (t / xTicks);
      var px = sx(tx);
      svg += '<line x1="' + px + '" y1="' + (padT + innerH) + '" x2="' + px + '" y2="' + (padT + innerH + 5) + '" stroke="' + border + '" stroke-width="1"/>';
      svg += '<text x="' + px + '" y="' + (padT + innerH + 22) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="' + textSoft + '">' + (Math.round(tx * 10) / 10) + '</text>';
    }

    function drawSeries(key, colorName, dashed) {
      var d = '';
      chart.points.forEach(function (p, i) {
        var val = p[key];
        if (val === undefined) return;
        d += (i === 0 ? 'M' : 'L') + sx(p.x) + ' ' + sy(val) + ' ';
      });
      if (!d) return;

      var col = colorFor(colorName);
      var gradId = 'g-' + key + '-' + Math.random().toString(36).slice(2, 7);
      svg += '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
             '<stop offset="0%" stop-color="' + col + '" stop-opacity="0.22"/>' +
             '<stop offset="100%" stop-color="' + col + '" stop-opacity="0"/>' +
             '</linearGradient></defs>';

      var firstVal = chart.points[0][key];
      var areaD = 'M' + sx(minX) + ' ' + sy(firstVal) + ' ' + d.replace(/^M/, 'L') +
                  ' L' + sx(maxX) + ' ' + (padT + innerH) + ' L' + sx(minX) + ' ' + (padT + innerH) + ' Z';

      svg += '<path d="' + areaD + '" fill="url(#' + gradId + ')"/>';
      svg += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2.5" ' +
             (dashed ? 'stroke-dasharray="6 5" ' : '') +
             'stroke-linecap="round" stroke-linejoin="round"/>';
    }

    var series = [];
    if (chart.points[0].y2 !== undefined) {
      drawSeries('y2', 'accent-2', false);
      series.push({ key: 'y2', color: 'accent-2', label: chart.legend ? chart.legend[0].label : 'Внесено' });
      drawSeries('y', 'accent', false);
      series.push({ key: 'y', color: 'accent', label: chart.legend ? chart.legend[1].label : 'Номинал' });
      if (chart.points[0].y3 !== undefined) {
        drawSeries('y3', 'accent-3', true);
        series.push({ key: 'y3', color: 'accent-3', label: chart.legend ? chart.legend[2].label : 'Реальная стоимость' });
      }
    } else {
      drawSeries('y', 'accent', false);
      series.push({ key: 'y', color: 'accent', label: 'Значение' });
    }

    /* --- маркер финальной точки --- */
    if (chart.marker) {
      var mx = sx(chart.marker.x);
      var my = sy(chart.marker.y);
      svg += '<circle cx="' + mx + '" cy="' + my + '" r="5" fill="' + surface + '" stroke="' + accent + '" stroke-width="2.5"/>';
      svg += '<circle cx="' + mx + '" cy="' + my + '" r="10" fill="' + accent + '" opacity="0.18"/>';
    }

    /* --- hover-слой --- */
    svg += '<line id="hoverLine" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + innerH) + '" stroke="' + accent + '" stroke-width="1" stroke-dasharray="3 4" opacity="0"/>';
    svg += '<circle id="hoverDot" r="4" fill="' + accent + '" stroke="' + surface + '" stroke-width="2" opacity="0"/>';
    svg += '<rect id="hoverHit" x="' + padL + '" y="' + padT + '" width="' + innerW + '" height="' + innerH + '" fill="transparent" style="pointer-events:all; cursor:crosshair;"/>';

    chartSvg.innerHTML = svg;

    var hoverLine = chartSvg.querySelector('#hoverLine');
    var hoverDot  = chartSvg.querySelector('#hoverDot');
    var hoverHit  = chartSvg.querySelector('#hoverHit');

    function xFromEvent(e) {
      var rect = chartSvg.getBoundingClientRect();
      var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var relX = (clientX - rect.left) / rect.width;
      return relX * W;
    }

    function nearestPoint(svgX) {
      var best = chart.points[0];
      var bestDist = Infinity;
      chart.points.forEach(function (p) {
        var px = sx(p.x);
        var d = Math.abs(px - svgX);
        if (d < bestDist) { bestDist = d; best = p; }
      });
      return best;
    }

    function showAt(svgX) {
      var pt = nearestPoint(svgX);
      var px = sx(pt.x);

      hoverLine.setAttribute('x1', px);
      hoverLine.setAttribute('x2', px);
      hoverLine.setAttribute('opacity', '0.8');

      var primaryKey = (pt.y !== undefined) ? 'y' : 'y2';
      var py = sy(pt[primaryKey]);
      hoverDot.setAttribute('cx', px);
      hoverDot.setAttribute('cy', py);
      hoverDot.setAttribute('opacity', '1');

      var tipEl = ensureTooltip();
      var rows = series.map(function (s) {
        if (pt[s.key] === undefined) return '';
        return '<div class="chart-tooltip__row">' +
               '<span class="chart-tooltip__dot" style="background:' + colorFor(s.color) + '"></span>' +
               '<span class="chart-tooltip__label">' + s.label + '</span>' +
               '<span class="chart-tooltip__value">' + formatMoney(pt[s.key]) + '</span>' +
               '</div>';
      }).join('');

      var xLabel = (maxX <= 60) ? ('Мес. ' + Math.round(pt.x)) : (pt.x.toFixed(1) + ' лет');
      tipEl.innerHTML = '<div class="chart-tooltip__row"><span class="chart-tooltip__label">' + xLabel + '</span></div>' + rows;

      var wrapRect = chartWrap.getBoundingClientRect();
      var pxRatio = wrapRect.width / W;
      var tipLeft = px * pxRatio;
      var tipTop  = py * (wrapRect.height / H);
      tipEl.style.left = tipLeft + 'px';
      tipEl.style.top  = tipTop  + 'px';
      tipEl.classList.add('is-visible');
    }

    function hideHover() {
      hoverLine.setAttribute('opacity', '0');
      hoverDot.setAttribute('opacity', '0');
      ensureTooltip().classList.remove('is-visible');
    }

    hoverHit.addEventListener('mousemove', function (e) { showAt(xFromEvent(e)); });
    hoverHit.addEventListener('mouseleave', hideHover);
    hoverHit.addEventListener('touchstart', function (e) { showAt(xFromEvent(e)); }, { passive: true });
    hoverHit.addEventListener('touchmove', function (e) { showAt(xFromEvent(e)); }, { passive: true });
    hoverHit.addEventListener('touchend', hideHover);

    chartWrap.classList.add('has-data');
  }

  /* ---------- РЕЗУЛЬТАТ ---------- */
  function showError(message) {
    panelResult.classList.remove('result--filled');
    panelResult.classList.add('result--error');
    panelResult.innerHTML = '<span class="result__value">Ошибка</span><span>' + message + '</span>';
    chartSvg.innerHTML = '';
    chartLegend.innerHTML = '';
    panelStats.innerHTML = '';
    chartWrap.classList.remove('has-data');
    ensureTooltip().classList.remove('is-visible');
  }

  function showResult(res) {
    panelResult.classList.remove('result--error');
    panelResult.classList.add('result--filled');
    panelResult.innerHTML = '<span class="result__value">' + res.value + '</span>' +
                            (res.note ? '<span class="result__note">' + res.note + '</span>' : '');
    if (res.stats) {
      panelStats.innerHTML = res.stats.map(function (s) {
        return '<div class="stat"><div class="stat__label">' + s.label + '</div><div class="stat__value">' + s.value + '</div></div>';
      }).join('');
    } else {
      panelStats.innerHTML = '';
    }
    if (res.chart) drawChart(res.chart);
    else { chartSvg.innerHTML = ''; chartLegend.innerHTML = ''; chartWrap.classList.remove('has-data'); }
  }

  function runCalculation() {
    var cfg = CALCS[currentKey];
    var values = readValues(currentKey);
    var res = cfg.compute(values);
    if (res.error) { showError(res.error); return; }
    showResult(res);
  }

  /* ---------- ПЕРЕКЛЮЧЕНИЕ ---------- */
  var tabs = document.querySelectorAll('.calc-tab');

  function activate(key) {
    if (!CALCS[key]) return;
    currentKey = key;
    var cfg = CALCS[key];

    tabs.forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-calc') === key);
    });

    panelEyebrow.textContent = cfg.eyebrow;
    panelTitle.textContent = cfg.title;
    panelDesc.textContent = cfg.desc;

    renderFields(key);

    panelResult.classList.remove('result--error');
    panelResult.classList.remove('result--filled');
    panelResult.textContent = 'Введите данные и нажмите «Рассчитать».';
    panelStats.innerHTML = '';
    chartSvg.innerHTML = '';
    chartLegend.innerHTML = '';
    chartWrap.classList.remove('has-data');
    ensureTooltip().classList.remove('is-visible');
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activate(this.getAttribute('data-calc'));
      if (window.innerWidth < 640) {
        calcPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  panelCalcBtn.addEventListener('click', runCalculation);

  panelFields.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runCalculation(); }
  });

  activate('deposit');
})();