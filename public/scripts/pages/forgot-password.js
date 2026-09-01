    const state = { step: 1, email: '', cooldown: 0, timer: null };
    const panels = Array.from(document.querySelectorAll('.reset-panel'));
    const indicators = Array.from(document.querySelectorAll('.reset-step'));
    const offlineNotice = document.getElementById('offlineNotice');

    function setStep(step) {
      state.step = step;
      panels.forEach((panel) => {
        const active = Number(panel.dataset.step) === step;
        panel.classList.toggle('is-active', active);
        panel.setAttribute('aria-hidden', String(!active));
      });
      indicators.forEach((indicator) => {
        const value = Number(indicator.dataset.stepIndicator);
        indicator.classList.toggle('is-active', value === step);
        indicator.classList.toggle('is-complete', value < step);
        if (value === step) indicator.setAttribute('aria-current', 'step');
        else indicator.removeAttribute('aria-current');
      });
      const activePanel = document.querySelector(`.reset-panel[data-step="${step}"]`);
      activePanel?.querySelector('input, a, button')?.focus();
    }

    function setButtonLoading(button, loading, label) {
      if (!button.dataset.label) button.dataset.label = button.textContent;
      button.disabled = loading || !navigator.onLine;
      button.innerHTML = loading
        ? `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> ${label}`
        : button.dataset.label;
    }

    function setError(id, message = '') {
      document.getElementById(id).textContent = message;
    }

    function updateOnlineState() {
      offlineNotice.classList.toggle('is-visible', !navigator.onLine);
      document.querySelectorAll('.reset-panel.is-active .btn-primary').forEach((button) => {
        if (!button.querySelector('.fa-spinner')) button.disabled = !navigator.onLine;
      });
    }

    function startCooldown(seconds = 60) {
      clearInterval(state.timer);
      state.cooldown = seconds;
      const button = document.getElementById('resendButton');
      const render = () => {
        button.disabled = state.cooldown > 0 || !navigator.onLine;
        button.textContent = state.cooldown > 0 ? `Resend in ${state.cooldown}s` : 'Resend code';
      };
      render();
      state.timer = setInterval(() => {
        state.cooldown -= 1;
        render();
        if (state.cooldown <= 0) clearInterval(state.timer);
      }, 1000);
    }

    document.getElementById('emailForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = document.getElementById('resetEmail');
      const email = input.value.trim().toLowerCase();
      const button = event.submitter;
      setError('emailError');

      if (!input.checkValidity()) {
        setError('emailError', 'Enter a valid email address.');
        input.focus();
        return;
      }
      if (!navigator.onLine) return updateOnlineState();

      setButtonLoading(button, true, 'Sending...');
      const { data, error } = await requestPasswordResetOtp(email);
      setButtonLoading(button, false);
      if (error) {
        setError('emailError', error.message);
        return;
      }

      state.email = email;
      document.getElementById('otpCopy').textContent = `${data.message} The code expires in 10 minutes.`;
      setStep(2);
      startCooldown(data.cooldown_seconds || 60);
    });

    document.getElementById('otpCode').addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
      setError('otpError');
    });

    document.getElementById('otpForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = document.getElementById('otpCode');
      const button = event.submitter;
      setError('otpError');
      if (!/^\d{6}$/.test(input.value)) {
        setError('otpError', 'Enter the complete 6-digit code.');
        return input.focus();
      }
      if (!navigator.onLine) return updateOnlineState();

      setButtonLoading(button, true, 'Verifying...');
      const { error } = await verifyPasswordResetOtp(state.email, input.value);
      setButtonLoading(button, false);
      if (error) {
        setError('otpError', error.message);
        input.select();
        return;
      }
      setStep(3);
    });

    document.getElementById('resendButton').addEventListener('click', async (event) => {
      if (state.cooldown > 0 || !navigator.onLine) return;
      const button = event.currentTarget;
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Sending...';
      const { data, error } = await requestPasswordResetOtp(state.email);
      if (error) {
        setError('otpError', error.message);
        button.textContent = 'Resend code';
        button.disabled = false;
        return;
      }
      setError('otpError', data.message);
      document.getElementById('otpCode').value = '';
      startCooldown(data.cooldown_seconds || 60);
    });

    document.getElementById('changeEmailButton').addEventListener('click', async () => {
      clearInterval(state.timer);
      await clearAuthSession();
      document.getElementById('otpCode').value = '';
      setError('otpError');
      setStep(1);
    });

    const newPassword = document.getElementById('newPassword');
    const passwordRules = {
      length: (value) => value.length >= 10,
      upper: (value) => /[A-Z]/.test(value),
      lower: (value) => /[a-z]/.test(value),
      number: (value) => /[0-9]/.test(value),
      special: (value) => /[^A-Za-z0-9]/.test(value)
    };

    newPassword.addEventListener('input', () => {
      const value = newPassword.value;
      let met = 0;
      Object.entries(passwordRules).forEach(([rule, test]) => {
        const passed = test(value);
        document.querySelector(`[data-rule="${rule}"]`).classList.toggle('is-met', passed);
        if (passed) met += 1;
      });
      const fill = document.getElementById('strengthFill');
      fill.style.width = `${met * 20}%`;
      fill.style.backgroundColor = met < 3 ? '#b91c1c' : met < 5 ? '#d97706' : '#047857';
      setError('passwordError');
    });

    document.querySelectorAll('.toggle-password').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.target);
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        button.querySelector('i').className = `fa-solid ${showing ? 'fa-eye' : 'fa-eye-slash'}`;
        button.setAttribute('aria-label', `${showing ? 'Show' : 'Hide'} password`);
      });
    });

    document.getElementById('passwordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = newPassword.value;
      const confirmation = document.getElementById('confirmPassword').value;
      const button = event.submitter;
      setError('passwordError');

      const check = validatePasswordPolicy(password, { email: state.email });
      if (!check.ok) return setError('passwordError', check.message);
      if (password !== confirmation) return setError('passwordError', 'Passwords do not match.');
      if (!navigator.onLine) return updateOnlineState();

      setButtonLoading(button, true, 'Resetting...');
      const { error } = await completePasswordReset(password, state.email);
      setButtonLoading(button, false);
      if (error) return setError('passwordError', error.message);

      setStep(4);
      let seconds = 6;
      const redirectCopy = document.getElementById('redirectCopy');
      const redirectTimer = setInterval(() => {
        seconds -= 1;
        redirectCopy.textContent = `Redirecting to login in ${seconds} seconds...`;
        if (seconds <= 0) {
          clearInterval(redirectTimer);
          window.location.href = 'login.html';
        }
      }, 1000);
      redirectCopy.textContent = `Redirecting to login in ${seconds} seconds...`;
    });

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    updateOnlineState();
