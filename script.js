/* =========================================================================
   TushuU Caller - Pure JS Call Management Demo
   Notes:
   - No frameworks, only vanilla JS and LocalStorage
   - Demo users: admin/admin123, tcaller/tcaller123
   - Pages use shared App/Auth/UI modules below
   ========================================================================= */
(function () {
  'use strict';

  // Utilities
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const formatDate = (d) => {
    if (!d) return '';
    const dt = (d instanceof Date) ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const addDays = (d, days) => {
    const dt = (d instanceof Date) ? new Date(d) : new Date(d || Date.now());
    dt.setDate(dt.getDate() + days);
    return dt;
  };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const csvEscape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // LocalStorage helpers
  const LS = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
      catch { return fallback; }
    },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    del(key) { localStorage.removeItem(key); },
    clearAll() {
      ['usersV1', 'customersV1', 'callLogsV1', 'currentUserV1'].forEach(k => localStorage.removeItem(k));
    }
  };

  // App: seed and accessors
  const App = {
    init() {
      if (!LS.get('usersV1')) {
        LS.set('usersV1', [
          { id: 'u_adm', name: 'Admin', username: 'admin', password: 'admin123', role: 'admin' },
          { id: 'u_tc1', name: 'Tele Caller', username: 'tcaller', password: 'tcaller123', role: 'telecaller' }
        ]);
      }
      if (!LS.get('customersV1')) {
        LS.set('customersV1', [
          { id: uid(), name: 'Rahul Sharma', phone: '9876543210', status: 'New', lastCallAt: '', nextAt: '', notes: '', assignedTo: 'u_tc1', history: [] },
          { id: uid(), name: 'Priya Verma', phone: '9898989898', status: 'New', lastCallAt: '', nextAt: '', notes: '', assignedTo: 'u_tc1', history: [] },
          { id: uid(), name: 'Amit Gupta', phone: '9001100222', status: 'Follow-up', lastCallAt: '', nextAt: formatDate(addDays(new Date(), 2)), notes: 'Call after 2 days', assignedTo: 'u_tc1', history: [] },
          { id: uid(), name: 'Sneha Mehta', phone: '9003300444', status: 'Not Interested', lastCallAt: '', nextAt: '', notes: 'Requested no calls', assignedTo: 'u_tc1', history: [] }
        ]);
      }
      if (!LS.get('callLogsV1')) LS.set('callLogsV1', []);
    },
    nowISO() { return new Date().toISOString(); },
    getUsers() { return LS.get('usersV1', []); },
    setUsers(u) { LS.set('usersV1', u); },
    getCustomers() { return LS.get('customersV1', []); },
    setCustomers(c) { LS.set('customersV1', c); },
    getLogs() { return LS.get('callLogsV1', []); },
    setLogs(l) { LS.set('callLogsV1', l); },
    getCurrentUser() { return LS.get('currentUserV1', null); },
    setCurrentUser(u) { LS.set('currentUserV1', u); },
    logout() { LS.del('currentUserV1'); location.href = 'index.html'; }
  };

  // Auth
  const Auth = {
    attachLogin(formId, errId, rememberId) {
      const form = document.getElementById(formId);
      const errEl = document.getElementById(errId);
      const remember = document.getElementById(rememberId);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = $('#username').value.trim();
        const password = $('#password').value;
        const users = App.getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) {
          errEl.classList.remove('hidden');
          return;
        }
        errEl.classList.add('hidden');
        App.setCurrentUser({ id: user.id, name: user.name, role: user.role, username: user.username, remember: !!remember.checked });
        if (user.role === 'admin') location.href = 'dashboard.html';
        else location.href = 'calls.html';
      });
    },
    guard(roles) {
      const u = App.getCurrentUser();
      if (!u) { location.href = 'index.html'; return; }
      if (roles && roles.length && !roles.includes(u.role)) {
        location.href = 'dashboard.html';
      }
    },
    current() { return App.getCurrentUser(); }
  };

  // UI
  const UI = {
    renderSidebar(active) {
      const el = $('#sidebar');
      if (!el) return;
      const u = Auth.current();
      const links = [
        { href: 'dashboard.html', key: 'dashboard', label: 'Dashboard' },
        { href: 'calls.html', key: 'calls', label: 'Calls' },
      ];
      if (u?.role === 'admin') links.push({ href: 'admin.html', key: 'admin', label: 'Admin' });
      el.innerHTML = `
        <h2 class="brand">Call Manager</h2>
        <div class="muted small" style="margin-bottom:10px;">${u ? `${u.name} • ${u.role}` : ''}</div>
        <nav class="nav">
          ${links.map(l => `<a href="${l.href}" class="${active === l.key ? 'active' : ''}">${l.label}</a>`).join('')}
        </nav>
        <button id="logoutBtn" class="btn" style="margin-top:12px;">Logout</button>
      `;
      $('#logoutBtn')?.addEventListener('click', App.logout);
    }
  };

  // Dashboard
  const Dashboard = {
    init() {
      this.renderMetrics();
      this.renderRecent();
    },
    scopedCustomers() {
      const u = Auth.current();
      const all = App.getCustomers();
      if (u.role === 'admin') return all;
      return all.filter(c => c.assignedTo === u.id);
    },
    renderMetrics() {
      const customers = this.scopedCustomers();
      const logs = App.getLogs();
      const total = customers.length;
      const pending = customers.filter(c => c.status === 'New').length;
      const follow = customers.filter(c => c.status === 'Follow-up').length;
      const u = Auth.current();
      const myCustIds = new Set(customers.map(c => c.id));
      const myLogs = logs.filter(l => (u.role === 'admin' || l.userId === u.id) && myCustIds.has(l.customerId));
      const connected = myLogs.filter(l => l.outcome === 'connected').length;
      const missed = myLogs.filter(l => l.outcome === 'missed').length;
      const cards = [
        { title: 'Total Calls', value: total },
        { title: 'Connected', value: connected },
        { title: 'Pending', value: pending },
        { title: 'Follow-ups', value: follow },
        { title: 'Missed', value: missed }
      ];
      $('#metricCards').innerHTML = cards.map(c => `
        <div class="card">
          <h3>${c.title}</h3>
          <div class="value">${c.value}</div>
        </div>
      `).join('');
    },
    renderRecent() {
      const logs = App.getLogs().slice().sort((a,b) => b.endedAt.localeCompare(a.endedAt)).slice(0, 8);
      const users = App.getUsers().reduce((m,u) => (m[u.id]=u, m), {});
      const customers = App.getCustomers().reduce((m,c) => (m[c.id]=c, m), {});
      $('#recentActivity').innerHTML = logs.map(l => {
        const who = users[l.userId]?.name || 'Unknown';
        const cust = customers[l.customerId]?.name || 'Customer';
        const when = new Date(l.endedAt).toLocaleString();
        return `<div class="item">${who} ${l.outcome} call with <strong>${cust}</strong> • ${when} • ${l.duration}s</div>`;
      }).join('') || '<div class="muted">No recent calls</div>';
    }
  };

  // Calls
  const Calls = {
    state: { filtered: [], timer: null, seconds: 0, currentId: null },
    init() {
      this.bindFilters();
      this.renderTable();
      this.setupModal();
    },
    scopedCustomers() {
      const u = Auth.current();
      const all = App.getCustomers();
      return u.role === 'admin' ? all : all.filter(c => c.assignedTo === u.id);
    },
    bindFilters() {
      $('#searchBox').addEventListener('input', () => this.renderTable());
      $('#statusFilter').addEventListener('change', () => this.renderTable());
    },
    filter(customers) {
      const q = $('#searchBox').value.trim().toLowerCase();
      const status = $('#statusFilter').value;
      let list = customers;
      if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
      if (status) list = list.filter(c => c.status === status);
      return list;
    },
    renderTable() {
      const users = App.getUsers().reduce((m,u) => (m[u.id]=u, m), {});
      const customers = this.filter(this.scopedCustomers());
      const tbody = $('#callsTable tbody');
      tbody.innerHTML = customers.map(c => `
        <tr data-id="${c.id}">
          <td data-label="Customer">${c.name}</td>
          <td data-label="Phone">${c.phone}</td>
          <td data-label="Status">${c.status}</td>
          <td data-label="Last Call">${c.lastCallAt ? formatDate(c.lastCallAt) : ''}</td>
          <td data-label="Next Follow-up">${c.nextAt ? formatDate(c.nextAt) : ''}</td>
          <td data-label="Notes">${(c.notes || '').slice(0, 36)}</td>
          <td data-label="Assigned To">${users[c.assignedTo]?.name || '-'}</td>
          <td data-label="Action"><button class="btn primary btn-call">Call</button></td>
        </tr>
      `).join('');
      $$('.btn-call', tbody).forEach(btn => btn.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        this.openCallModal(tr.getAttribute('data-id'));
      }));
    },
    setupModal() {
      $('#cancelCallBtn').addEventListener('click', () => this.closeModal());
      $('#endCallBtn').addEventListener('click', () => this.finishCall());
    },
    openCallModal(id) {
      this.state.currentId = id;
      this.state.seconds = 0;
      $('#callModalTitle').textContent = 'Calling...';
      $('#callTimer').textContent = '00:00';
      $('#callOutcome').value = 'connected';
      $('#callStatusUpdate').value = 'Called';
      $('#callNotes').value = '';
      $('.modal').classList.remove('hidden');
      this.state.timer = setInterval(() => {
        this.state.seconds++;
        const m = String(Math.floor(this.state.seconds / 60)).padStart(2, '0');
        const s = String(this.state.seconds % 60).padStart(2, '0');
        $('#callTimer').textContent = `${m}:${s}`;
      }, 1000);
    },
    closeModal() {
      clearInterval(this.state.timer);
      this.state.timer = null;
      $('.modal').classList.add('hidden');
    },
    finishCall() {
      const customers = App.getCustomers();
      const c = customers.find(x => x.id === this.state.currentId);
      if (!c) { this.closeModal(); return; }
      const outcome = $('#callOutcome').value;
      const newStatus = $('#callStatusUpdate').value;
      const notes = $('#callNotes').value.trim();
      const now = new Date();

      c.status = newStatus;
      c.lastCallAt = now.toISOString();
      c.notes = notes || c.notes;
      if (newStatus === 'Follow-up') c.nextAt = addDays(now, 3).toISOString();
      else if (newStatus === 'Not Interested') c.nextAt = '';
      else c.nextAt = c.nextAt || '';
      c.history.push({ at: now.toISOString(), outcome, status: newStatus, duration: this.state.seconds, notes });
      App.setCustomers(customers);

      const u = Auth.current();
      const logs = App.getLogs();
      logs.push({
        id: uid(),
        customerId: c.id,
        userId: u.id,
        startedAt: new Date(now.getTime() - this.state.seconds * 1000).toISOString(),
        endedAt: now.toISOString(),
        duration: this.state.seconds,
        outcome,
        notes
      });
      App.setLogs(logs);

      this.closeModal();
      this.renderTable();
    }
  };

  // Admin
  const Admin = {
    init() {
      this.renderTelecallers();
      this.bindTelecallerForm();
      this.renderCustomers();
      this.bindLeadsUpload();
      $('#clearAllData').addEventListener('click', () => {
        if (confirm('This will clear all data and log you out. Proceed?')) {
          LS.clearAll();
          location.href = 'index.html';
        }
      });
    },
    telecallers() {
      return App.getUsers().filter(u => u.role === 'telecaller');
    },
    renderTelecallers() {
      const tbody = $('#telecallerTable tbody');
      const tcs = this.telecallers();
      tbody.innerHTML = tcs.map(tc => `
        <tr data-id="${tc.id}">
          <td data-label="Name">${tc.name}</td>
          <td data-label="Username">${tc.username}</td>
          <td data-label="Actions">
            <button class="btn btn-edit">Edit</button>
            <button class="btn danger btn-delete">Delete</button>
          </td>
        </tr>
      `).join('');
      $$('.btn-edit', tbody).forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.target.closest('tr').getAttribute('data-id');
        this.editTelecaller(id);
      }));
      $$('.btn-delete', tbody).forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.target.closest('tr').getAttribute('data-id');
        this.deleteTelecaller(id);
      }));
    },
    bindTelecallerForm() {
      $('#telecallerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#tcName').value.trim();
        const username = $('#tcUsername').value.trim();
        const password = $('#tcPassword').value;
        if (!name || !username || !password) return;
        const users = App.getUsers();
        if (users.some(u => u.username === username)) {
          alert('Username already exists');
          return;
        }
        users.push({ id: uid(), name, username, password, role: 'telecaller' });
        App.setUsers(users);
        $('#telecallerForm').reset();
        this.renderTelecallers();
        this.renderCustomers(); // refresh assigns
      });
    },
    editTelecaller(id) {
      const users = App.getUsers();
      const u = users.find(x => x.id === id);
      if (!u) return;
      const name = prompt('Edit name', u.name) ?? u.name;
      const username = prompt('Edit username', u.username) ?? u.username;
      if (!name || !username) return;
      if (username !== u.username && users.some(x => x.username === username)) {
        alert('Username already exists');
        return;
      }
      u.name = name;
      u.username = username;
      App.setUsers(users);
      this.renderTelecallers();
      this.renderCustomers();
    },
    deleteTelecaller(id) {
      const users = App.getUsers();
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return;
      if (!confirm('Delete this telecaller?')) return;
      const removed = users.splice(idx, 1)[0];
      App.setUsers(users);
      // Unassign customers from this telecaller
      const customers = App.getCustomers();
      customers.forEach(c => { if (c.assignedTo === removed.id) c.assignedTo = ''; });
      App.setCustomers(customers);
      this.renderTelecallers();
      this.renderCustomers();
    },
    renderCustomers() {
      const tbody = $('#adminCustomersTable tbody');
      const customers = App.getCustomers();
      const tcs = this.telecallers();
      tbody.innerHTML = customers.map(c => `
        <tr data-id="${c.id}">
          <td data-label="Customer">${c.name}</td>
          <td data-label="Phone">${c.phone}</td>
          <td data-label="Status">${c.status}</td>
          <td data-label="Assigned To">
            <select class="assignSel">
              <option value="">Unassigned</option>
              ${tcs.map(tc => `<option value="${tc.id}" ${tc.id===c.assignedTo?'selected':''}>${tc.name}</option>`).join('')}
            </select>
          </td>
          <td data-label="Actions">
            <button class="btn danger btn-remove">Remove</button>
          </td>
        </tr>
      `).join('');
      $$('.assignSel', tbody).forEach(sel => sel.addEventListener('change', (e) => {
        const tr = e.target.closest('tr');
        const id = tr.getAttribute('data-id');
        const customers = App.getCustomers();
        const c = customers.find(x => x.id === id);
        c.assignedTo = e.target.value;
        App.setCustomers(customers);
      }));
      $$('.btn-remove', tbody).forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.target.closest('tr').getAttribute('data-id');
        if (!confirm('Remove this customer?')) return;
        let customers = App.getCustomers();
        customers = customers.filter(c => c.id !== id);
        App.setCustomers(customers);
        this.renderCustomers();
      }));
    },
    bindLeadsUpload() {
      const input = $('#leadsFile');
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            if (!Array.isArray(data)) throw new Error('JSON must be an array');
            const customers = App.getCustomers();
            const dedupPhones = new Set(customers.map(c => c.phone));
            data.forEach(item => {
              const name = String(item.name || '').trim();
              const phone = String(item.phone || '').trim();
              const notes = String(item.notes || '');
              if (!name || !phone || dedupPhones.has(phone)) return;
              customers.push({ id: uid(), name, phone, status: 'New', lastCallAt: '', nextAt: '', notes, assignedTo: '', history: [] });
              dedupPhones.add(phone);
            });
            App.setCustomers(customers);
            alert('Leads imported');
            this.renderCustomers();
            input.value = '';
          } catch (e) {
            alert('Invalid JSON file');
          }
        };
        reader.readAsText(file);
      });
    }
  };

  // Reports
  const Reports = {
    exportCsv() {
      const u = Auth.current();
      const all = App.getCustomers();
      const customers = u.role === 'admin' ? all : all.filter(c => c.assignedTo === u.id);
      const header = ['Customer Name','Phone Number','Status','Last Call Date','Next Follow-up Date','Notes','Assigned To','History Count'];
      const users = App.getUsers().reduce((m,u) => (m[u.id]=u, m), {});
      const rows = customers.map(c => [
        c.name, c.phone, c.status, formatDate(c.lastCallAt), formatDate(c.nextAt), c.notes || '', users[c.assignedTo]?.name || '', (c.history||[]).length
      ]);
      const csv = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-report-${formatDate(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  // Expose modules
  window.App = App;
  window.Auth = Auth;
  window.UI = UI;
  window.Dashboard = Dashboard;
  window.Calls = Calls;
  window.Admin = Admin;
  window.Reports = Reports;
})();
