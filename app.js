const SERVER_ADDRESS = 'oyna.melarun.com.tr';
const toastElement = document.querySelector('.toast');

function showToast(message) {
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastElement.classList.remove('show'), 3000);
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(successMessage);
  } catch {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    showToast(copied ? successMessage : 'Kopyalama başarısız oldu. Metni seçip kopyalayabilirsin.');
  }
}

document.querySelectorAll('.copy-address').forEach((button) => {
  button.addEventListener('click', () => copyText(SERVER_ADDRESS, 'Sunucu adresi kopyalandı.'));
});

const menuButton = document.querySelector('.menu');
const nav = document.querySelector('.site-nav');
if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const opened = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(opened));
    menuButton.setAttribute('aria-label', opened ? 'Menüyü kapat' : 'Menüyü aç');
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Menüyü aç');
  }));
}

const rankingLabels = { kills: 'ÖLDÜRME', wins: 'GALİBİYET', kd: 'K/D' };
document.querySelectorAll('[data-stat]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-stat]').forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-pressed', String(selected));
    });
    const label = document.querySelector('#ranking-label');
    if (label) label.textContent = rankingLabels[button.dataset.stat] || 'İSTATİSTİK';
  });
});

const storeCategories = document.querySelectorAll('[data-store-category]');
storeCategories.forEach((button) => {
  button.addEventListener('click', () => {
    storeCategories.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    const categoryName = button.querySelector('strong')?.textContent || 'Tüm kategoriler';
    const title = document.querySelector('#catalog-title');
    const emptyTitle = document.querySelector('#catalog-empty-title');
    if (title) title.textContent = button.dataset.storeCategory === 'all' ? 'Ürünler' : categoryName;
    if (emptyTitle) emptyTitle.textContent = button.dataset.storeCategory === 'all' ? 'Henüz yayında ürün yok.' : `${categoryName} kategorisinde yayında ürün yok.`;
    document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const supportForm = document.querySelector('#support-form');
if (supportForm) {
  supportForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!supportForm.reportValidity()) return;
    if (window.MELARUN_BACKEND_READY) {
      window.dispatchEvent(new CustomEvent('melarun:backend-support-submit'));
      return;
    }
    const fields = new FormData(supportForm);
    const message = [
      'Melarun destek talebi',
      `Oyuncu adı: ${String(fields.get('player')).trim()}`,
      `Konu: ${String(fields.get('category')).trim()}`,
      'Açıklama:',
      String(fields.get('details')).trim(),
    ].join('\n');
    copyText(message, 'Destek mesajı kopyalandı. Yönetim kanalına iletebilirsin.');
  });
}

const faqSearch = document.querySelector('#faq-search');
const faqItems = [...document.querySelectorAll('#help-list details')];
if (faqSearch && faqItems.length) {
  faqSearch.addEventListener('input', () => {
    const query = faqSearch.value.trim().toLocaleLowerCase('tr');
    let visibleCount = 0;
    faqItems.forEach((item) => {
      const visible = item.textContent.toLocaleLowerCase('tr').includes(query);
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    const noResults = document.querySelector('#faq-no-results');
    if (noResults) noResults.hidden = visibleCount !== 0;
  });
}

const authTabs = document.querySelectorAll('[data-auth-tab]');
const authPanels = document.querySelectorAll('[data-auth-panel]');
const accountHeading = document.querySelector('#account-heading');
authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const selectedPanel = tab.dataset.authTab;
    authTabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    authPanels.forEach((panel) => { panel.hidden = panel.dataset.authPanel !== selectedPanel; });
    if (accountHeading) accountHeading.textContent = selectedPanel === 'register' ? 'Hesap oluştur' : 'Giriş yap';
  });
});
