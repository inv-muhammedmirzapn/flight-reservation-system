export const formatCurrency = (amount, currencyCode = 'INR') => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return '';
  const num = Number(amount);
  const curr = (currencyCode || 'INR').toUpperCase();

  const localeMap = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    AUD: 'en-AU',
    CAD: 'en-CA',
    AED: 'en-AE',
    SAR: 'en-SA',
    QAR: 'en-QA',
    SGD: 'en-SG',
    JPY: 'ja-JP',
    CHF: 'de-CH',
    NZD: 'en-NZ',
    CNY: 'zh-CN',
  };

  const locale = localeMap[curr] || 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'JPY' || curr === 'INR' ? (num % 1 === 0 ? 0 : 2) : 2,
    }).format(num);
  } catch {
    return `${curr} ${num.toFixed(2)}`;
  }
};

export const INR = (amount) => formatCurrency(amount, 'INR');

export const fmtTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const diffHM = (dep, arr) => {
  if (!dep || !arr) return 'N/A';
  try {
    const ms = new Date(arr) - new Date(dep);
    if (isNaN(ms)) return 'N/A';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  } catch {
    return 'N/A';
  }
};
