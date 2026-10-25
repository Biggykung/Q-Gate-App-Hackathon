(() => {
  const allowedPages = new Set(['/', '/index.html', '/dashboard.html', '/kidney-twin.html']);
  const pathname = window.location.pathname;
  const isLoginPage = pathname.endsWith('/login.html');
  const isRegisterPage = pathname.endsWith('/register.html');
  const isPatientPortal = pathname.endsWith('/patient.html');
  const isPublicAuthPage = isLoginPage || isRegisterPage;
  document.documentElement.classList.add('auth-pending');

  function safeNext() {
    const candidate = new URLSearchParams(window.location.search).get('next') || '/';
    const path = candidate.split('?')[0];
    return allowedPages.has(path) ? candidate : '/';
  }

  function landingPage(user) {
    const destination = safeNext();
    const path = destination.split('?')[0];
    if (user?.role === 'patient') return '/patient.html';
    if (user?.role === 'viewer' && path === '/dashboard.html') return '/';
    return destination;
  }

  function revealPage(user) {
    window.KIDQ_USER = user;
    const applyAccessRules = () => {
      if (user) {
        document.body.dataset.role = user.role;
        if (user.role === 'viewer') {
          const backLink = document.getElementById('backNavigationLink');
          if (backLink) {
            backLink.href = 'index.html';
            const label = document.getElementById('backNavigationLabel');
            if (label) label.textContent = 'กลับสู่แบบฟอร์ม';
          }
        }
        document.querySelectorAll('[data-write-role]').forEach((element) => {
          const roles = element.dataset.writeRole.split(',').map((role) => role.trim());
          const shouldHide = !roles.includes(user.role);
          element.hidden = shouldHide;
          element.classList.toggle('hidden', shouldHide);
        });
        document.querySelectorAll('[data-hide-role]').forEach((element) => {
          const roles = element.dataset.hideRole.split(',').map((role) => role.trim());
          const shouldHide = roles.includes(user.role);
          element.hidden = shouldHide;
          element.classList.toggle('hidden', shouldHide);
        });
        document.querySelectorAll('[data-admin-role]').forEach((element) => {
          const shouldHide = user.role !== 'admin';
          element.hidden = shouldHide;
          element.classList.toggle('hidden', shouldHide);
        });
      }
      document.documentElement.classList.remove('auth-pending');
    };
    if (document.body) applyAccessRules();
    else document.addEventListener('DOMContentLoaded', applyAccessRules, { once: true });
  }

  function attachPageActions() {
    const logoutButton = document.getElementById('logoutButton');
    logoutButton?.addEventListener('click', async () => {
      logoutButton.disabled = true;
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } finally {
        window.location.replace('/login.html');
      }
    });

    const loginForm = document.getElementById('loginForm');
    loginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = loginForm.querySelector('button[type="submit"]');
      const message = document.getElementById('loginMessage');
      button.disabled = true;
      message.textContent = 'กำลังเข้าสู่ระบบ...';
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        window.location.replace(landingPage(data.user));
      } catch (error) {
        message.textContent = error.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        button.disabled = false;
      }
    });

    const registerForm = document.getElementById('registerForm');
    registerForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = document.getElementById('registerMessage');
      const button = registerForm.querySelector('button[type="submit"]');
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      if (password !== confirmPassword) {
        message.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
        return;
      }

      button.disabled = true;
      message.classList.remove('text-rose-700');
      message.classList.add('text-emerald-800');
      message.textContent = 'กำลังสร้างบัญชี...';
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('username').value.trim(),
            password,
            patient_code: document.getElementById('patientCode').value.trim()
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'สมัครสมาชิกไม่สำเร็จ');
        message.textContent = data.message || 'สมัครสมาชิกสำเร็จ';
        registerForm.hidden = true;
        document.getElementById('registerLoginLink').classList.remove('hidden');
      } catch (error) {
        message.classList.remove('text-emerald-800');
        message.classList.add('text-rose-700');
        message.textContent = error.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        button.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachPageActions, { once: true });
  else attachPageActions();

  window.KIDQ_AUTH_READY = fetch('/api/auth/session', { credentials: 'same-origin' })
    .then((response) => response.json())
    .then((data) => {
      if (isPublicAuthPage) {
        if (data.authenticated) window.location.replace(landingPage(data.user));
        else revealPage(null);
        return null;
      }
      if (!data.authenticated) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.replace(`/login.html?next=${encodeURIComponent(next)}`);
        return null;
      }
      if (data.user.role === 'patient' && !isPatientPortal) {
        window.location.replace('/patient.html');
        return null;
      }
      if (data.user.role !== 'patient' && isPatientPortal) {
        window.location.replace(landingPage(data.user));
        return null;
      }
      if (data.user.role === 'viewer' && pathname === '/dashboard.html') {
        window.location.replace('/');
        return null;
      }
      revealPage(data.user);
      return data.user;
    })
    .catch(() => {
      if (isPublicAuthPage) revealPage(null);
      else window.location.replace('/login.html');
      return null;
    });
})();
