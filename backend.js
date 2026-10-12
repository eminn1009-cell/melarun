const configuration = window.MELARUN_SUPABASE_CONFIG || {};
const accountNote = document.querySelector('#account-setup-note');

function setNotice(element, heading, message, state = 'info') {
  if (!element) return;
  element.dataset.state = state;
  const strong = element.querySelector('strong');
  const paragraph = element.querySelector('p');
  if (strong) strong.textContent = heading;
  if (paragraph) paragraph.textContent = message;
}

function showToast(message) {
  const toast = document.querySelector('.toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3500);
}

if (!configuration.url || !configuration.publishableKey) {
  const supportStatus = document.querySelector('#support-status p');
  const supportButton = document.querySelector('#support-form button[type="submit"]');
  const supportHelp = document.querySelector('#support-form-note');
  if (supportStatus) supportStatus.textContent = 'Destek servisi şu an bağlı değil. Mesajı kopyalayıp Melarun yönetimine iletebilirsin.';
  if (supportButton) supportButton.innerHTML = 'Mesajı kopyala <span aria-hidden="true">↗</span>';
  if (supportHelp) supportHelp.textContent = 'Destek sistemi açılana kadar form metni yalnızca kopyalanır; talep kaydedilmez.';
} else {
  initializeBackend().catch(() => {
    setNotice(accountNote, 'Bağlantı kurulamadı.', 'Hesap servisine ulaşılamadı. Biraz sonra tekrar dene.', 'error');
    const supportStatus = document.querySelector('#support-status p');
    if (supportStatus) supportStatus.textContent = 'Destek servisine şu an ulaşılamıyor. Biraz sonra yeniden dene.';
  });
}

async function initializeBackend() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.117.2');
  const supabase = createClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  window.MELARUN_SUPABASE = supabase;
  window.MELARUN_BACKEND_READY = true;

  document.querySelectorAll('.auth-form fieldset').forEach((fieldset) => { fieldset.disabled = false; });
  setNotice(accountNote, 'Güvenli hesap servisi bağlı.', 'E-posta adresinle giriş yapabilir veya yeni hesap oluşturabilirsin.', 'success');
  const supportButton = document.querySelector('#support-form button[type="submit"]');
  if (supportButton) supportButton.innerHTML = 'Destek talebi gönder <span aria-hidden="true">↗</span>';
  const supportHelp = document.querySelector('#support-form-note');
  if (supportHelp) supportHelp.textContent = 'Talep oluşturmak için hesabına giriş yap. Yanıtları bu sayfada görüp yazabilirsin.';
  const supportStatus = document.querySelector('#support-status p');
  if (supportStatus) supportStatus.textContent = 'Hesabına giriş yaparak talep açabilir, yönetim yanıtlarını bu sayfadan takip edebilirsin.';

  bindAuthentication(supabase);
  bindCatalog(supabase);
  bindRanking(supabase);
  bindSupport(supabase);

  const { data } = await supabase.auth.getSession();
  await renderSession(supabase, data.session);
  supabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => renderSession(supabase, session), 0);
  });
}

function bindAuthentication(supabase) {
  document.querySelectorAll('.auth-form[data-auth-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const email = String(fields.get('email') || '').trim();
      const password = String(fields.get('password') || '');
      const button = form.querySelector('button[type="submit"]');
      const submitLabel = button?.textContent || '';
      if (button) { button.disabled = true; button.textContent = 'İşleniyor…'; }

      try {
        if (form.dataset.authForm === 'register') {
          const username = String(fields.get('minecraft_username') || '').trim();
          const confirmation = String(fields.get('password_confirmation') || '');
          if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
            showToast('Minecraft adı 3–16 harf, rakam veya alt çizgi olmalı.');
            return;
          }
          if (password.length < 8 || password !== confirmation) {
            showToast(password.length < 8 ? 'Parola en az 8 karakter olmalı.' : 'Parolalar eşleşmiyor.');
            return;
          }
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { minecraft_username: username },
              emailRedirectTo: `${window.location.origin}/hesap/`,
            },
          });
          if (error) throw error;
          if (data.session) showToast('Hesabın oluşturuldu. Melarun’a hoş geldin.');
          else showToast('Hesabın hazır. Giriş için e-postandaki doğrulama bağlantısına tıkla.');
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          showToast('Giriş başarılı.');
        }
      } catch (error) {
        const message = String(error?.message || '').toLocaleLowerCase('tr');
        if (message.includes('invalid login credentials')) showToast('E-posta veya parola hatalı.');
        else if (message.includes('already registered')) showToast('Bu e-posta zaten kayıtlı. Giriş yapmayı dene.');
        else if (message.includes('email not confirmed')) showToast('Önce e-postandaki doğrulama bağlantısına tıkla.');
        else if (message.includes('email address not authorized') || message.includes('email rate limit exceeded') || message.includes('over_email_send_rate_limit')) showToast('Doğrulama e-postası şu anda gönderilemiyor. Daha sonra yeniden dene.');
        else showToast('İşlem tamamlanamadı. Bilgileri kontrol edip tekrar dene.');
      } finally {
        if (button) { button.disabled = false; button.textContent = submitLabel; }
      }
    });
  });
}

async function renderSession(supabase, session) {
  const forms = document.querySelector('#auth-forms');
  const sessionPanel = document.querySelector('#auth-session');
  const signOut = document.querySelector('#auth-sign-out');
  if (forms) forms.hidden = Boolean(session);
  if (sessionPanel) sessionPanel.hidden = !session;
  const supportStatus = document.querySelector('#support-status p');
  if (supportStatus) supportStatus.textContent = session
    ? 'Talebin yönetim paneline iletilir; yanıtları buradan takip edebilirsin.'
    : 'Talep göndermek ve yönetim yanıtlarını görmek için hesabına giriş yap.';
  if (!session) return;

  const username = session.user.user_metadata?.minecraft_username || session.user.email || 'Melarun oyuncusu';
  const usernameTarget = document.querySelector('#auth-session-name');
  if (usernameTarget) usernameTarget.textContent = username;
  const adminLink = document.querySelector('#admin-panel-link');
  if (adminLink) adminLink.hidden = session.user.app_metadata?.role !== 'admin';
  setNotice(accountNote, 'Hesabın açık.', 'Destek taleplerini gönderebilir ve durumlarını takip edebilirsin.', 'success');
  if (signOut && !signOut.dataset.bound) {
    signOut.dataset.bound = 'true';
    signOut.addEventListener('click', async () => {
      await supabase.auth.signOut();
      showToast('Hesabından çıkış yapıldı.');
    });
  }
  await loadSupportTickets(supabase);
}

function bindCatalog(supabase) {
  const grid = document.querySelector('#product-grid');
  if (!grid) return;
  let category = 'all';
  const buttons = [...document.querySelectorAll('[data-store-category]')];
  buttons.forEach((button) => button.addEventListener('click', () => {
    category = button.dataset.storeCategory || 'all';
    renderProducts(supabase, grid, category);
  }));
  renderProducts(supabase, grid, category);
}

async function renderProducts(supabase, grid, category) {
  const empty = document.querySelector('#catalog-empty');
  const count = document.querySelector('.catalog-count');
  const title = document.querySelector('#catalog-title');
  const categoryButton = document.querySelector(`[data-store-category="${CSS.escape(category)}"]`);
  const categoryTitle = categoryButton?.querySelector('strong')?.textContent || 'Ürünler';
  if (title) title.textContent = category === 'all' ? 'Ürünler' : categoryTitle;
  grid.replaceChildren();
  const query = supabase.from('store_products').select('id,slug,name,category,description,price_try,image_url,checkout_url,tag_label,tag_color').eq('is_published', true).order('sort_order').order('name');
  const { data, error } = category === 'all' ? await query : await query.eq('category', category);
  if (error) {
    const hasFallback = grid.childElementCount > 0;
    if (empty) empty.hidden = hasFallback;
    grid.hidden = !hasFallback;
    if (count) count.textContent = hasFallback ? `${grid.childElementCount} ÜRÜN` : '—';
    const heading = document.querySelector('#catalog-empty-title');
    if (!hasFallback && heading) heading.textContent = 'Market şu an yüklenemedi.';
    return;
  }
  const products = data || [];
  if (count) count.textContent = `${products.length} ÜRÜN`;
  if (empty) empty.hidden = products.length > 0;
  grid.hidden = products.length === 0;
  const heading = document.querySelector('#catalog-empty-title');
  if (heading) heading.textContent = products.length ? '' : (category === 'all' ? 'Henüz yayında ürün yok.' : `${categoryTitle} kategorisinde yayında ürün yok.`);

  for (const product of products) grid.append(createProductCard(product));
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  const image = document.createElement('div');
  const imageVariants = { gold: 'vip', purple: 'mvip', cyan: 'svip' };
  const imageVariant = imageVariants[product.tag_color];
  image.className = `product-image${imageVariant ? ` product-image--${imageVariant}` : ''}`;
  if (product.image_url) {
    try {
      const imageUrl = new URL(product.image_url);
      if (imageUrl.protocol === 'https:') {
        const img = document.createElement('img');
        img.src = imageUrl.href;
        img.alt = '';
        img.loading = 'lazy';
        image.append(img);
      }
    } catch { /* Invalid image URLs are ignored. */ }
  }
  if (!image.childElementCount) image.textContent = product.tag_label?.charAt(0) || 'M';
  const copy = document.createElement('div');
  copy.className = 'product-copy';
  const name = document.createElement('h3');
  name.textContent = product.name;
  if (product.tag_label) {
    const colors = { gold: 'gold', purple: 'purple', cyan: 'cyan' };
    const tag = document.createElement('span');
    tag.className = `rank-tag rank-tag--${colors[product.tag_color] || 'neutral'}`;
    tag.textContent = product.tag_label;
    name.append(' ', tag);
  }
  const description = document.createElement('p');
  description.textContent = product.description || 'Melarun market ürünü';
  const price = document.createElement('strong');
  price.className = 'product-price';
  price.textContent = product.price_try == null
    ? 'Fiyat yakında'
    : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(product.price_try));
  copy.append(name, description);
  const footer = document.createElement('div');
  footer.className = 'product-footer';
  footer.append(price);
  if (product.checkout_url) {
    try {
      const checkout = new URL(product.checkout_url);
      if (checkout.protocol === 'https:') {
        const link = document.createElement('a');
        link.className = 'button button-main';
        link.href = checkout.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Satın al ↗';
        footer.append(link);
      }
    } catch { /* Invalid checkout URLs are never rendered as links. */ }
  } else {
    const unavailable = document.createElement('span');
    unavailable.className = 'product-unavailable';
    unavailable.textContent = 'Satış yakında';
    footer.append(unavailable);
  }
  card.append(image, copy, footer);
  return card;
}

function bindRanking(supabase) {
  const rows = document.querySelector('#ranking-rows');
  if (!rows) return;
  document.querySelectorAll('[data-stat]').forEach((button) => button.addEventListener('click', () => {
    renderRanking(supabase, button.dataset.stat || 'kills');
  }));
  renderRanking(supabase, 'kills');
}

async function renderRanking(supabase, statistic) {
  const rows = document.querySelector('#ranking-rows');
  const empty = document.querySelector('#ranking-empty');
  const status = document.querySelector('#ranking-status');
  const updated = document.querySelector('#ranking-updated');
  const label = document.querySelector('#ranking-label');
  if (!rows) return;
  const labels = { kills: 'ÖLDÜRME', wins: 'GALİBİYET', kd: 'K/D' };
  if (label) label.textContent = labels[statistic] || labels.kills;
  rows.replaceChildren();
  const { data, error } = await supabase.from('player_stats')
    .select('minecraft_username,kills,deaths,wins,updated_at');
  if (error) {
    if (status) status.textContent = 'VERİ YÜKLENEMEDİ';
    if (empty) empty.hidden = false;
    return;
  }
  const players = (data || []).map((player) => ({
    ...player,
    kd: player.deaths === 0 ? player.kills : player.kills / player.deaths,
  })).sort((a, b) => (Number(b[statistic]) || 0) - (Number(a[statistic]) || 0)).slice(0, 100);
  if (status) status.textContent = 'SUNUCU VERİSİ BAĞLI';
  if (updated) {
    const newest = players.reduce((latest, player) => Math.max(latest, Date.parse(player.updated_at) || 0), 0);
    updated.textContent = newest ? `Güncellendi ${new Date(newest).toLocaleString('tr-TR')}` : 'Güncel veri';
  }
  if (empty) empty.hidden = players.length > 0;
  players.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'ranking-row';
    const place = document.createElement('span');
    place.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('strong');
    name.textContent = player.minecraft_username;
    const score = document.createElement('span');
    score.textContent = statistic === 'kd' ? player.kd.toFixed(2) : new Intl.NumberFormat('tr-TR').format(Number(player[statistic]) || 0);
    row.append(place, name, score);
    rows.append(row);
  });
}

function bindSupport(supabase) {
  const form = document.querySelector('#support-form');
  const ticketList = document.querySelector('#support-tickets');
  if (ticketList && !ticketList.dataset.replyBound) {
    ticketList.dataset.replyBound = 'true';
    ticketList.addEventListener('submit', async (event) => {
      const replyForm = event.target.closest('form[data-support-reply]');
      if (!replyForm) return;
      event.preventDefault();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { showToast('Yanıt göndermek için hesabına giriş yap.'); return; }
      const textarea = replyForm.querySelector('textarea');
      const message = String(textarea?.value || '').trim();
      if (!message || message.length > 2000) return;
      const button = replyForm.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'Gönderiliyor…'; }
      const { error } = await supabase.from('support_ticket_messages').insert({
        ticket_id: replyForm.dataset.ticketId,
        author_id: session.user.id,
        author_role: 'player',
        message,
      });
      if (error) {
        showToast('Yanıt gönderilemedi. Talep kapatılmış olabilir.');
        if (button) { button.disabled = false; button.textContent = 'Yanıtla'; }
        return;
      }
      await loadSupportTickets(supabase);
      showToast('Yanıtın destek ekibine iletildi.');
    });
  }
  if (!form) return;
  window.addEventListener('melarun:backend-support-submit', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const note = document.querySelector('#support-auth-note');
      if (note) note.hidden = false;
      showToast('Talep göndermek için önce hesabına giriş yap.');
      return;
    }
    const fields = new FormData(form);
    const labels = {
      'Bağlantı sorunu': 'connection',
      'Oyuncu bildirimi': 'player-report',
      'Market veya hesap': 'market-account',
      'Diğer': 'other',
    };
    const { error } = await supabase.from('support_tickets').insert({
      user_id: session.user.id,
      minecraft_username: String(fields.get('player')).trim(),
      category: labels[String(fields.get('category'))] || 'other',
      message: String(fields.get('details')).trim(),
    });
    if (error) {
      showToast('Talep kaydedilemedi. Bilgileri kontrol edip tekrar dene.');
      return;
    }
    form.reset();
    showToast('Talebin gönderildi. Durumunu bu sayfadan takip edebilirsin.');
    await loadSupportTickets(supabase);
  });
}

async function loadSupportTickets(supabase) {
  const list = document.querySelector('#support-tickets');
  if (!list) return;
  const { data, error } = await supabase.from('support_tickets')
    .select('id,category,message,status,created_at')
    .order('created_at', { ascending: false }).limit(20);
  if (error) return;
  list.replaceChildren();
  if (!data?.length) {
    const empty = document.createElement('p');
    empty.className = 'form-note';
    empty.textContent = 'Henüz destek talebin yok.';
    list.append(empty);
    return;
  }
  const { data: replies, error: repliesError } = await supabase.from('support_ticket_messages')
    .select('ticket_id,author_role,message,created_at')
    .in('ticket_id', data.map((ticket) => ticket.id))
    .order('created_at', { ascending: true });
  const repliesByTicket = new Map();
  if (!repliesError) {
    for (const reply of replies || []) {
      if (!repliesByTicket.has(reply.ticket_id)) repliesByTicket.set(reply.ticket_id, []);
      repliesByTicket.get(reply.ticket_id).push(reply);
    }
  }
  const statuses = { open: 'Açık', 'in-progress': 'İnceleniyor', closed: 'Kapandı' };
  const topics = { connection: 'Bağlantı sorunu', 'player-report': 'Oyuncu bildirimi', 'market-account': 'Market veya hesap', other: 'Diğer' };
  for (const ticket of data) {
    const item = document.createElement('article');
    item.className = `ticket-row${ticket.status === 'closed' ? ' ticket-row--closed' : ''}`;
    const heading = document.createElement('div');
    heading.className = 'ticket-row-heading';
    const subject = document.createElement('strong');
    subject.textContent = `${topics[ticket.category] || 'Destek'} · ${statuses[ticket.status] || 'Açık'}`;
    heading.append(subject);
    const meta = document.createElement('small');
    meta.textContent = `${statuses[ticket.status] || 'Açık'} · ${new Date(ticket.created_at).toLocaleDateString('tr-TR')}`;
    heading.append(meta);
    const thread = document.createElement('div');
    thread.className = 'support-thread';
    const firstMessage = document.createElement('article');
    firstMessage.className = 'support-thread-message support-thread-message--player';
    const firstAuthor = document.createElement('strong');
    firstAuthor.textContent = 'Sen · Talep';
    const firstCopy = document.createElement('p');
    firstCopy.textContent = ticket.message;
    firstMessage.append(firstAuthor, firstCopy);
    thread.append(firstMessage);
    for (const reply of repliesByTicket.get(ticket.id) || []) {
      const replyItem = document.createElement('article');
      replyItem.className = `support-thread-message support-thread-message--${reply.author_role === 'admin' ? 'admin' : 'player'}`;
      const author = document.createElement('strong');
      author.textContent = reply.author_role === 'admin' ? 'Melarun Destek' : 'Sen';
      const copy = document.createElement('p');
      copy.textContent = reply.message;
      replyItem.append(author, copy);
      thread.append(replyItem);
    }
    if (repliesError) {
      const note = document.createElement('p');
      note.className = 'form-note';
      note.textContent = 'Yanıtlar şu an yüklenemedi.';
      thread.append(note);
    }
    item.append(heading, thread);
    if (ticket.status !== 'closed') {
      const replyForm = document.createElement('form');
      replyForm.className = 'support-reply-form';
      replyForm.dataset.supportReply = 'true';
      replyForm.dataset.ticketId = ticket.id;
      const replyInput = document.createElement('textarea');
      replyInput.rows = 2;
      replyInput.maxLength = 2000;
      replyInput.required = true;
      replyInput.placeholder = 'Bu talebe yanıt yaz…';
      replyInput.setAttribute('aria-label', 'Destek talebine yanıt yaz');
      const replyButton = document.createElement('button');
      replyButton.className = 'button button-outline';
      replyButton.type = 'submit';
      replyButton.textContent = 'Yanıtla ↗';
      replyForm.append(replyInput, replyButton);
      item.append(replyForm);
    } else {
      const closedNote = document.createElement('small');
      closedNote.className = 'ticket-closed-note';
      closedNote.textContent = 'Bu talep kapatıldı. Yeni bir konu için yeni talep açabilirsin.';
      item.append(closedNote);
    }
    list.append(item);
  }
}
