// Plus Pexel - Trello Denetim Web App Logic

// Global State
let state = {
    workspaces: [],
    boards: [],
    selectedWorkspaceId: '',
    selectedBoardId: '',
    selectedBoardName: '',
    cards: [], // Cache of loaded cards
    members: [], // Cache of loaded members
    logs: []
};

// ---------------- BACKGROUND PARTICLE CANVAS ----------------
function initBgCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let particles = [];
    const particleCount = 60;
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.radius = Math.random() * 2 + 1;
            this.color = `rgba(139, 92, 246, ${Math.random() * 0.3 + 0.15})`; // Subtle purple tones
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    }

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid connections
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
            
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(139, 92, 246, ${(1 - dist / 120) * 0.08})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}

// ---------------- TIME DISPLAY & UTILS ----------------
function startClock() {
    const timeEl = document.getElementById('console-time');
    setInterval(() => {
        const d = new Date();
        const hrs = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        const secs = String(d.getSeconds()).padStart(2, '0');
        if (timeEl) timeEl.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
}

function writeLog(message, type = 'info') {
    const container = document.getElementById('console-logs');
    if (!container) return;
    
    const line = document.createElement('div');
    line.className = `log-line log-${type}`;
    
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${message}`;
    
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('active'), 50);
    
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ---------------- MODAL MANAGEMENT ----------------
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// Global confirmation controller
let confirmCallback = null;
function requestConfirmation(title, message, isVerificationNeeded, verificationString, callback) {
    const modal = document.getElementById('modal-confirm');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    const verifContainer = document.getElementById('confirm-verification-container');
    const verifInput = document.getElementById('confirm-verification-input');
    
    if (isVerificationNeeded) {
        verifContainer.style.display = 'block';
        verifInput.value = '';
    } else {
        verifContainer.style.display = 'none';
    }
    
    confirmCallback = () => {
        if (isVerificationNeeded) {
            if (verifInput.value.trim().toLowerCase() !== verificationString.toLowerCase()) {
                showToast("Güvenlik doğrulaması eşleşmedi!", "error");
                writeLog("❌ Doğrulama başarısız. İşlem iptal edildi.", "error");
                return;
            }
        }
        callback();
        closeModal('modal-confirm');
    };
    
    openModal('modal-confirm');
}

// ---------------- DATA FETCHING ----------------
async function loadWorkspaces() {
    try {
        const response = await fetch('/api/workspaces');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        state.workspaces = data;
        const select = document.getElementById('workspace-select');
        select.innerHTML = '<option value="">-- Çalışma Alanı Seçin --</option>';
        
        data.forEach(ws => {
            const opt = document.createElement('option');
            opt.value = ws.id;
            opt.textContent = ws.displayName;
            select.appendChild(opt);
        });
        
        writeLog("✅ Çalışma alanları başarıyla yüklendi.");
    } catch (err) {
        showToast("Çalışma alanları yüklenemedi!", "error");
        writeLog(`❌ Hata: ${err.message}`, "error");
    }
}

async function loadBoards(workspaceId) {
    if (!workspaceId) {
        document.getElementById('board-list').innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 10px;">Çalışma alanı seçin...</div>';
        return;
    }
    
    const listContainer = document.getElementById('board-list');
    listContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 10px;">Panolar çekiliyor...</div>';
    
    try {
        const response = await fetch(`/api/boards?workspace_id=${workspaceId}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        state.boards = data;
        listContainer.innerHTML = '';
        
        if (data.length === 0) {
            listContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 10px;">Pano bulunamadı.</div>';
            return;
        }
        
        data.forEach(b => {
            const item = document.createElement('div');
            item.className = 'board-item';
            item.dataset.id = b.id;
            item.dataset.name = b.name;
            
            item.innerHTML = `
                <div class="board-info">
                    <span class="board-title">${b.name}</span>
                </div>
                <button class="board-action-btn delete-board-btn" title="Panoyu Sil">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            `;
            
            // Highlight list selection
            item.addEventListener('click', (e) => {
                if (e.target.closest('.delete-board-btn')) return;
                
                document.querySelectorAll('.board-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                state.selectedBoardId = b.id;
                state.selectedBoardName = b.name;
                
                writeLog(`📌 Pano seçildi: ${b.name}`);
                
                // Clear tables & load members/cards
                clearCardTable();
                loadBoardMembers(b.id);
            });
            
            // Delete board listener
            item.querySelector('.delete-board-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                
                requestConfirmation(
                    "Panoyu Sil", 
                    `"${b.name}" panosunu KALICI olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`,
                    true,
                    b.name,
                    async () => {
                        writeLog(`🗑️ Pano siliniyor: "${b.name}"...`);
                        try {
                            const res = await fetch(`/api/delete_board/${b.id}`, { method: 'DELETE' });
                            const resJson = await res.json();
                            if (resJson.error) throw new Error(resJson.error);
                            
                            showToast("Pano silindi!", "success");
                            writeLog(`✅ Pano başarıyla silindi: "${b.name}"`, "success");
                            
                            if (state.selectedBoardId === b.id) {
                                state.selectedBoardId = '';
                                state.selectedBoardName = '';
                                clearCardTable();
                                clearMemberTable();
                            }
                            
                            loadBoards(workspaceId);
                        } catch (err) {
                            showToast("Pano silinemedi!", "error");
                            writeLog(`❌ Pano silme hatası: ${err.message}`, "error");
                        }
                    }
                );
            });
            
            listContainer.appendChild(item);
        });
        
        writeLog(`✅ ${data.length} adet pano listelendi.`);
    } catch (err) {
        showToast("Panolar listelenemedi!", "error");
        writeLog(`❌ Hata: ${err.message}`, "error");
    }
}

async function loadBoardMembers(boardId) {
    const tbody = document.getElementById('members-tbody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">Üyeler yükleniyor...</td></tr>';
    
    try {
        const response = await fetch(`/api/board_members?board_id=${boardId}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        state.members = data;
        document.getElementById('stat-members').textContent = data.length;
        
        renderMembers(data);
        writeLog(`👥 ${data.length} pano üyesi yüklendi.`);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--accent-red); padding: 20px;">Hata oluştu.</td></tr>';
        writeLog(`❌ Üye yükleme hatası: ${err.message}`, "error");
    }
}

function renderMembers(membersList) {
    const tbody = document.getElementById('members-tbody');
    tbody.innerHTML = '';
    
    if (membersList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">Panoda üye bulunmuyor.</td></tr>';
        return;
    }
    
    membersList.forEach(m => {
        const tr = document.createElement('tr');
        tr.dataset.id = m.id;
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <label class="custom-checkbox" style="justify-content: center; height: 16px;">
                    <input type="checkbox" class="member-select-chk" value="${m.id}">
                    <span class="checkbox-box" style="margin:0;"></span>
                </label>
            </td>
            <td>${m.fullName}</td>
            <td>@${m.username}</td>
        `;
        
        tr.addEventListener('click', (e) => {
            if (e.target.closest('label')) return;
            const chk = tr.querySelector('.member-select-chk');
            chk.checked = !chk.checked;
            tr.classList.toggle('selected', chk.checked);
        });
        
        tbody.appendChild(tr);
    });
}

function clearCardTable() {
    state.cards = [];
    document.getElementById('stat-cards').textContent = '0';
    document.getElementById('cards-tbody').innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">Bulunan kartları yüklemek için arama yapın veya filtre uygulayın.</td></tr>';
}

function clearMemberTable() {
    state.members = [];
    document.getElementById('stat-members').textContent = '0';
    document.getElementById('members-tbody').innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 40px;">Lütfen bir pano seçin.</td></tr>';
}

async function fetchCards(params) {
    if (!state.selectedBoardId) {
        showToast("Lütfen önce bir pano seçin!", "error");
        return;
    }
    
    const tbody = document.getElementById('cards-tbody');
    tbody.innerHTML = `
        <tr class="shimmer-row"><td colspan="6" style="height: 35px;"></td></tr>
        <tr class="shimmer-row"><td colspan="6" style="height: 35px;"></td></tr>
        <tr class="shimmer-row"><td colspan="6" style="height: 35px;"></td></tr>
    `;
    
    try {
        const queryParams = new URLSearchParams({
            board_id: state.selectedBoardId,
            ...params
        });
        
        const response = await fetch(`/api/cards?${queryParams.toString()}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        state.cards = data;
        document.getElementById('stat-cards').textContent = data.length;
        
        renderCards(data);
        writeLog(`✅ ${data.length} adet kart listelendi.`);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--accent-red); padding: 40px;">Kartlar çekilirken hata oluştu.</td></tr>';
        writeLog(`❌ Kart çekme hatası: ${err.message}`, "error");
    }
}

function renderCards(cardsList) {
    const tbody = document.getElementById('cards-tbody');
    tbody.innerHTML = '';
    
    if (cardsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">Aradığınız kriterlere uygun kart bulunamadı.</td></tr>';
        return;
    }
    
    cardsList.forEach(c => {
        const tr = document.createElement('tr');
        tr.dataset.id = c.id;
        
        let statusBadge = '';
        if (c.status === 'Arşivlenmiş') statusBadge = '<span class="badge badge-archived">Arşiv</span>';
        else if (c.status === 'Tamamlandı') statusBadge = '<span class="badge badge-completed">Tamamlandı</span>';
        else statusBadge = '<span class="badge badge-open">Açık</span>';
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <label class="custom-checkbox" style="justify-content: center; height: 16px;">
                    <input type="checkbox" class="card-select-chk" value="${c.id}">
                    <span class="checkbox-box" style="margin:0;"></span>
                </label>
            </td>
            <td style="font-weight:600;" title="${c.name}">${c.name}</td>
            <td>${c.list_name}</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td style="text-align: center;">${c.due}</td>
            <td style="text-align: center;">${c.created_at}</td>
        `;
        
        // Handle select highlights
        tr.addEventListener('click', (e) => {
            if (e.target.closest('label')) return;
            const chk = tr.querySelector('.card-select-chk');
            chk.checked = !chk.checked;
            tr.classList.toggle('selected', chk.checked);
        });
        
        // Handle double click for details modal
        tr.addEventListener('dblclick', () => {
            showCardDetails(c);
        });
        
        tbody.appendChild(tr);
    });
}

// ---------------- CARD DETAILS POPUP ----------------
function showCardDetails(card) {
    const body = document.getElementById('detail-card-body');
    document.getElementById('detail-card-name').textContent = card.name;
    
    // Labels
    let labelsHtml = '';
    if (card.labels && card.labels.length > 0) {
        card.labels.forEach(lbl => {
            labelsHtml += `<span class="label-pill">${lbl}</span>`;
        });
    } else {
        labelsHtml = '<span style="font-size:12px; color:var(--text-muted);">Etiket yok</span>';
    }
    
    // Description
    const descHtml = card.desc.trim() 
        ? `<div class="detail-desc">${card.desc.replace(/\n/g, '<br>')}</div>` 
        : '<div style="font-size:12px; color:var(--text-muted); font-style:italic;">Açıklama girilmemiş</div>';
        
    // Checklists
    let checklistsHtml = '';
    if (card.checklists && card.checklists.length > 0) {
        card.checklists.forEach(cl => {
            let items = '';
            cl.items.forEach(item => {
                const complete = item.state === 'Tamamlandı';
                items += `
                    <div class="checklist-item">
                        <span style="color:${complete ? 'var(--accent-green)' : 'var(--text-muted)'}">${complete ? '✓' : '○'}</span>
                        <span style="${complete ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${item.name}</span>
                    </div>
                `;
            });
            checklistsHtml += `
                <div class="checklist-group">
                    <div class="checklist-title">☑️ ${cl.name}</div>
                    ${items}
                </div>
            `;
        });
    } else {
        checklistsHtml = '<span style="font-size:12px; color:var(--text-muted);">Kontrol listesi yok</span>';
    }
    
    // Comments
    let commentsHtml = '';
    if (card.comments && card.comments.length > 0) {
        card.comments.forEach(c => {
            const time = new Date(c.date).toLocaleString('tr-TR');
            commentsHtml += `
                <div class="comment-card">
                    <div class="comment-meta">
                        <span class="comment-creator">${c.creator}</span>
                        <span>${time}</span>
                    </div>
                    <div class="comment-text">${c.text}</div>
                </div>
            `;
        });
    } else {
        commentsHtml = '<span style="font-size:12px; color:var(--text-muted);">Yorum yapılmamış</span>';
    }
    
    body.innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">📌 Detay & Konum</div>
            <div style="font-size:13px; color:var(--text-muted);">
                Liste: <strong style="color:var(--text-light);">${card.list_name}</strong> | Durum: <strong style="color:var(--text-light);">${card.status}</strong> | Oluşturulma: <strong style="color:var(--text-light);">${card.created_at}</strong>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">🏷️ Etiketler</div>
            <div>${labelsHtml}</div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">📝 Açıklama</div>
            ${descHtml}
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">☑️ Kontrol Listeleri</div>
            <div style="display:flex; flex-direction:column; gap:12px;">${checklistsHtml}</div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">💬 Yorumlar</div>
            <div style="display:flex; flex-direction:column; gap:8px;">${commentsHtml}</div>
        </div>
    `;
    
    // Set url handler
    const btnUrl = document.getElementById('btn-open-trello-url');
    btnUrl.onclick = () => window.open(card.url, '_blank');
    
    openModal('modal-card-details');
}

// ---------------- BATCH CARD OPERATIONS ----------------
async function markSelectedCardsCompleted() {
    const selectedIds = Array.from(document.querySelectorAll('.card-select-chk:checked')).map(el => el.value);
    if (selectedIds.length === 0) {
        showToast("Lütfen kart seçin!", "error");
        return;
    }
    
    requestConfirmation(
        "Tamamlandı İşareti", 
        `Seçilen ${selectedIds.length} kart Trello'da 'Tamamlandı' olarak işaretlenecek. Onaylıyor musunuz?`,
        false, '',
        async () => {
            writeLog("Tamamlandı işlemleri başlatıldı...");
            try {
                const res = await fetch('/api/update_card', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ card_ids: selectedIds })
                });
                const resJson = await res.json();
                if (resJson.error) throw new Error(resJson.error);
                
                showToast(`${resJson.count} adet kart güncellendi!`, "success");
                writeLog(`✅ Toplam ${resJson.count} kart tamamlandı yapıldı.`, "success");
                
                // Refresh
                state.cards.forEach(c => {
                    if (selectedIds.includes(c.id)) {
                        c.status = 'Tamamlandı';
                        c.due_complete = true;
                    }
                });
                renderCards(state.cards);
            } catch (err) {
                showToast("Güncelleme başarısız!", "error");
                writeLog(`❌ Hata: ${err.message}`, "error");
            }
        }
    );
}

async function deleteSelectedCards() {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.card-select-chk:checked'));
    let selectedIds = selectedCheckboxes.map(el => el.value);
    
    if (selectedIds.length === 0) {
        if (state.cards.length === 0) {
            showToast("Silinecek kart yok!", "error");
            return;
        }
        
        // Delete all in workspace table
        requestConfirmation(
            "Tüm Kartları Sil (Kritik)", 
            `Listelenen ${state.cards.length} kartın TAMAMI Trello'dan KALICI olarak silinecektir. Bu işlem geri alınamaz! Onaylıyor musunuz?`,
            false, '',
            async () => {
                selectedIds = state.cards.map(c => c.id);
                executeCardsDelete(selectedIds);
            }
        );
    } else {
        requestConfirmation(
            "Seçilen Kartları Sil", 
            `Seçilen ${selectedIds.length} kart Trello'dan KALICI olarak silinecektir. Onaylıyor musunuz?`,
            false, '',
            async () => {
                executeCardsDelete(selectedIds);
            }
        );
    }
}

async function executeCardsDelete(cardIds) {
    writeLog("Kart silme işlemleri başlatıldı...");
    try {
        const res = await fetch('/api/delete_cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_ids: cardIds })
        });
        const resJson = await res.json();
        if (resJson.error) throw new Error(resJson.error);
        
        showToast("Kartlar silindi!", "success");
        writeLog(`✅ Toplam ${resJson.count} kart silindi.`, "success");
        
        // Remove from state
        state.cards = state.cards.filter(c => !cardIds.includes(c.id));
        document.getElementById('stat-cards').textContent = state.cards.length;
        renderCards(state.cards);
    } catch (err) {
        showToast("Kartlar silinemedi!", "error");
        writeLog(`❌ Hata: ${err.message}`, "error");
    }
}

// ---------------- EXPORT JSON ----------------
function exportCardsJson() {
    if (state.cards.length === 0) {
        showToast("Veri çekilmedi!", "error");
        return;
    }
    
    const selectedIds = Array.from(document.querySelectorAll('.card-select-chk:checked')).map(el => el.value);
    let cardsToExport = state.cards;
    
    if (selectedIds.length > 0) {
        const opt = confirm(`Sadece seçilen ${selectedIds.length} kartı mı kaydetmek istersiniz?\n(Tamam: Sadece Seçilenler, İptal: Tüm Liste)`);
        if (opt) {
            cardsToExport = state.cards.filter(c => selectedIds.includes(c.id));
        }
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cardsToExport, null, 4));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `trello_yedek_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
    
    writeLog(`💾 ${cardsToExport.length} kart JSON olarak dışa aktarıldı.`);
    showToast("JSON yedek indirildi!", "success");
}

// ---------------- BOARD MEMBERS AUDIT ----------------
async function removeSelectedMembers() {
    const selectedIds = Array.from(document.querySelectorAll('.member-select-chk:checked')).map(el => el.value);
    if (selectedIds.length === 0) {
        showToast("Lütfen üye seçin!", "error");
        return;
    }
    
    requestConfirmation(
        "Üye Çıkarma Onayı", 
        `Seçilen ${selectedIds.length} üye "${state.selectedBoardName}" panosundan KALICI olarak çıkarılacaktır. Onaylıyor musunuz?`,
        false, '',
        async () => {
            writeLog("Üyeleri çıkarma işlemi başlatıldı...");
            let removedCount = 0;
            
            for (const mid of selectedIds) {
                try {
                    const res = await fetch('/api/remove_member', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ board_id: state.selectedBoardId, member_id: mid })
                    });
                    const resJson = await res.json();
                    if (resJson.error) throw new Error(resJson.error);
                    
                    removedCount++;
                    writeLog(`Üye panodan çıkarıldı ID: ${mid}`);
                } catch (err) {
                    writeLog(`❌ Hata (Üye ID: ${mid}): ${err.message}`, "error");
                }
            }
            
            showToast(`${removedCount} üye panodan çıkarıldı!`, "success");
            writeLog(`✅ Toplam ${removedCount} üye panodan çıkarıldı.`, "success");
            
            // Reload members
            loadBoardMembers(state.selectedBoardId);
        }
    );
}

// ---------------- SMART EXTRA TASK ALLOCATION ----------------
async function assignExtraTask() {
    const titleInput = document.getElementById('task-title');
    const descInput = document.getElementById('task-desc');
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();
    const wsSelect = document.getElementById('workspace-select');
    const wsId = wsSelect.value;
    
    if (!wsId) {
        showToast("Lütfen Çalışma Alanı seçin!", "error");
        return;
    }
    if (!title) {
        showToast("Lütfen görev başlığı yazın!", "error");
        titleInput.focus();
        return;
    }
    
    const btn = document.getElementById('btn-assign-task');
    btn.disabled = true;
    btn.textContent = '⏱ Analiz Ediliyor...';
    writeLog(`⚡ Görev Dağıtıcı: "${title}" görevi dağıtılmak için inceleniyor...`);
    
    try {
        const response = await fetch('/api/assign_extra_task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace_id: wsId, name: title, desc: desc })
        });
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        if (data.status === 'auto_assigned') {
            showToast("Görev otomatik atandı!", "success");
            writeLog(data.message, "success");
            
            // Clear inputs
            titleInput.value = '';
            descInput.value = '';
            
            // Reload currently active details if needed
            if (state.selectedBoardId) {
                loadBoardMembers(state.selectedBoardId);
            }
        } else if (data.status === 'choose_needed') {
            writeLog("ℹ️ Tüm panolarda açık kart var. Kullanıcı seçimi bekleniyor.");
            showToast("Tüm panolarda görev var! Seçim yapın.", "info");
            
            renderAllocationChoices(data.boards, title, desc);
        }
    } catch (err) {
        showToast("Görev atanamadı!", "error");
        writeLog(`❌ Hata: ${err.message}`, "error");
    } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Görev Dağıt';
    }
}

function renderAllocationChoices(boardsList, taskTitle, taskDesc) {
    const list = document.getElementById('assign-choice-list');
    list.innerHTML = '';
    
    boardsList.forEach(b => {
        const row = document.createElement('div');
        row.className = 'board-choice-item';
        
        row.innerHTML = `
            <div class="board-choice-details">
                <span class="board-choice-name">${b.board_name}</span>
                <span class="board-choice-count">Açık Kart Sayısı: ${b.open_card_count}</span>
            </div>
            <button class="btn btn-primary btn-sm assign-board-manual-btn" data-id="${b.board_id}" data-name="${b.board_name}">
                Atama Yap
            </button>
        `;
        
        row.querySelector('.assign-board-manual-btn').addEventListener('click', async () => {
            closeModal('modal-assign-choice');
            writeLog(`⚡ Görev "${b.board_name}" panosuna atanıyor...`);
            
            try {
                const res = await fetch('/api/assign_extra_task_manual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ board_id: b.board_id, name: taskTitle, desc: taskDesc })
                });
                const resJson = await res.json();
                if (resJson.error) throw new Error(resJson.error);
                
                showToast("Görev panoya atandı!", "success");
                writeLog(`✅ Görev "${b.board_name}" panosundaki "${resJson.list_name}" listesine başarıyla atandı.`, "success");
                
                // Clear fields
                document.getElementById('task-title').value = '';
                document.getElementById('task-desc').value = '';
            } catch (err) {
                showToast("Manuel atama hatası!", "error");
                writeLog(`❌ Manuel atama hatası: ${err.message}`, "error");
            }
        });
        
        list.appendChild(row);
    });
    
    openModal('modal-assign-choice');
}

// ---------------- TAB NAVIGATION ----------------
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.view-panel');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const activePanel = document.getElementById(tab.dataset.tab);
            if (activePanel) {
                activePanel.classList.add('active');
            }
        });
    });
}

// ---------------- LOCAL LIVE SEARCH FILTERS ----------------
function initSearchFilters() {
    // Card live search
    document.getElementById('cards-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (state.cards.length === 0) return;
        
        const filtered = state.cards.filter(c => 
            c.name.toLowerCase().includes(query) || 
            c.list_name.toLowerCase().includes(query) ||
            c.status.toLowerCase().includes(query)
        );
        renderCards(filtered);
    });

    // Member live search
    document.getElementById('members-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (state.members.length === 0) return;
        
        const filtered = state.members.filter(m => 
            m.fullName.toLowerCase().includes(query) || 
            m.username.toLowerCase().includes(query)
        );
        renderMembers(filtered);
    });
}

// ---------------- SELECT ALL CHECKBOX LOGIC ----------------
function initSelectAll() {
    // Select all cards
    document.getElementById('select-all-cards').addEventListener('change', (e) => {
        const boxes = document.querySelectorAll('.card-select-chk');
        boxes.forEach(box => {
            box.checked = e.target.checked;
            box.closest('tr').classList.toggle('selected', e.target.checked);
        });
    });

    // Select all members
    document.getElementById('select-all-members').addEventListener('change', (e) => {
        const boxes = document.querySelectorAll('.member-select-chk');
        boxes.forEach(box => {
            box.checked = e.target.checked;
            box.closest('tr').classList.toggle('selected', e.target.checked);
        });
    });
}

// ---------------- CAMERA BARCODE & PRODUCT SCANNER ----------------
let html5QrCodeScanner = null;

function initCameraScanner() {
    const btnScan = document.getElementById('btn-camera-scan');
    const btnClose = document.getElementById('btn-close-camera');
    const btnStop = document.getElementById('btn-stop-camera');
    const btnManualSubmit = document.getElementById('btn-manual-barcode-submit');
    const manualInput = document.getElementById('manual-barcode-input');

    if (btnScan) btnScan.addEventListener('click', openCameraModal);
    if (btnClose) btnClose.addEventListener('click', closeCameraModal);
    if (btnStop) btnStop.addEventListener('click', closeCameraModal);

    if (btnManualSubmit && manualInput) {
        btnManualSubmit.addEventListener('click', () => {
            const val = manualInput.value.trim();
            if (val) matchScannedProduct(val);
        });

        manualInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const val = manualInput.value.trim();
                if (val) matchScannedProduct(val);
            }
        });
    }
}

function openCameraModal() {
    const modal = document.getElementById('modal-camera-scanner');
    if (!modal) return;
    modal.classList.add('active');
    
    const statusEl = document.getElementById('scan-status');
    if (statusEl) statusEl.innerHTML = 'Kamera başlatılıyor, lütfen bekleyin...';
    
    const manualInput = document.getElementById('manual-barcode-input');
    if (manualInput) manualInput.value = '';

    startCameraScanner();
}

function closeCameraModal() {
    const modal = document.getElementById('modal-camera-scanner');
    if (modal) modal.classList.remove('active');
    stopCameraScanner();
}

function stopCameraScanner() {
    if (html5QrCodeScanner) {
        try {
            html5QrCodeScanner.stop().then(() => {
                html5QrCodeScanner.clear();
                html5QrCodeScanner = null;
            }).catch(err => {
                console.warn('Camera stop error:', err);
                html5QrCodeScanner = null;
            });
        } catch (e) {
            html5QrCodeScanner = null;
        }
    }
}

function startCameraScanner() {
    const qrReaderEl = document.getElementById('qr-reader');
    if (!qrReaderEl) return;
    
    if (html5QrCodeScanner) {
        stopCameraScanner();
    }

    const onScanSuccess = (decodedText, decodedResult) => {
        if (!decodedText) return;
        writeLog(`📷 Kamera okuması yapıldı: "${decodedText}"`, 'info');
        matchScannedProduct(decodedText);
    };

    const onScanFailure = (error) => {
        // Continuous scanning frame noise ignored
    };

    if (typeof Html5Qrcode !== 'undefined') {
        html5QrCodeScanner = new Html5Qrcode("qr-reader");
        const config = { fps: 15, qrbox: { width: 220, height: 220 } };
        
        // Environment camera first for mobile back camera
        html5QrCodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
            .then(() => {
                const statusEl = document.getElementById('scan-status');
                if (statusEl) statusEl.innerHTML = '📷 Kamera aktif! QR kodu veya barkodu çerçeveye getirin.';
            })
            .catch(err => {
                console.warn('Environment camera unavailable, falling back to default:', err);
                html5QrCodeScanner.start({ facingMode: "user" }, config, onScanSuccess, onScanFailure)
                    .then(() => {
                        const statusEl = document.getElementById('scan-status');
                        if (statusEl) statusEl.innerHTML = '📷 Kamera aktif! QR kodu veya barkodu çerçeveye getirin.';
                    })
                    .catch(camErr => {
                        console.error('Camera startup error:', camErr);
                        const statusEl = document.getElementById('scan-status');
                        if (statusEl) statusEl.innerHTML = '❌ Kameraya erişilemedi! Kamera iznini kontrol edin veya aşağıdan elle kod girin.';
                    });
            });
    } else {
        const statusEl = document.getElementById('scan-status');
        if (statusEl) statusEl.innerHTML = '⚠️ Barkod tarayıcı modülü yüklenemedi. Aşağıdaki kutudan elle kod girebilirsiniz.';
    }
}

function matchScannedProduct(scannedCode) {
    if (!scannedCode) return;
    const cleanCode = scannedCode.trim().toLowerCase();
    
    // Mobile haptic feedback
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }
    
    // Update live search input and trigger table filter
    const searchInput = document.getElementById('cards-search');
    if (searchInput) {
        searchInput.value = scannedCode;
        searchInput.dispatchEvent(new Event('input'));
    }
    
    // Find matching product card in state.cards
    let matchedCard = state.cards.find(c => {
        const name = (c.name || '').toLowerCase();
        const desc = (c.desc || '').toLowerCase();
        const id = (c.id || '').toLowerCase();
        const shortLink = (c.shortLink || '').toLowerCase();
        
        return name.includes(cleanCode) || 
               desc.includes(cleanCode) || 
               id === cleanCode || 
               shortLink === cleanCode;
    });

    const statusEl = document.getElementById('scan-status');

    if (matchedCard) {
        if (statusEl) statusEl.innerHTML = `✅ <span style="color: var(--accent-green);">Eşleşti: ${matchedCard.name}</span>`;
        showToast(`✅ Ürün Eşleşti: ${matchedCard.name}`, 'success');
        writeLog(`✅ Kamera ile ürün eşleşti: ${matchedCard.name} (${scannedCode})`, 'success');
        
        // Highlight row in table
        setTimeout(() => {
            const rows = document.querySelectorAll('#cards-tbody tr');
            rows.forEach(row => {
                if (row.innerText.includes(matchedCard.name)) {
                    row.classList.remove('row-matched');
                    void row.offsetWidth; // Trigger reflow
                    row.classList.add('row-matched');
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }, 150);

        // Close camera modal on success
        setTimeout(() => {
            closeCameraModal();
        }, 1300);
    } else {
        if (statusEl) statusEl.innerHTML = `🔍 "${scannedCode}" için sonuçlar filtrelendi.`;
        showToast(`🔍 "${scannedCode}" filtrelendi.`, 'info');
        
        setTimeout(() => {
            closeCameraModal();
        }, 1500);
    }
}

// ---------------- INITIALIZATION ----------------
document.addEventListener('DOMContentLoaded', () => {
    // Background and tools
    initBgCanvas();
    startClock();
    initTabs();
    initSearchFilters();
    initSelectAll();
    initCameraScanner();
    
    // Fetch initial workspace list
    loadWorkspaces();
    
    // Bind workspace dropdown change
    document.getElementById('workspace-select').addEventListener('change', (e) => {
        state.selectedWorkspaceId = e.target.value;
        loadBoards(e.target.value);
    });

    // Bind searches
    document.getElementById('btn-date-search').addEventListener('click', () => {
        const start = document.getElementById('start-date').value;
        const end = document.getElementById('end-date').value;
        fetchCards({
            filter_by_date: 'true',
            start_date: start,
            end_date: end
        });
    });

    document.getElementById('btn-special-search').addEventListener('click', () => {
        const incArchived = document.getElementById('chk-archived').checked;
        const incIncomplete = document.getElementById('chk-incomplete').checked;
        fetchCards({
            filter_by_date: 'false',
            include_archived: incArchived ? 'true' : 'false',
            include_incomplete: incIncomplete ? 'true' : 'false'
        });
    });

    // Card Batch Buttons
    document.getElementById('btn-export-json').addEventListener('click', exportCardsJson);
    document.getElementById('btn-complete-selected').addEventListener('click', markSelectedCardsCompleted);
    document.getElementById('btn-delete-selected').addEventListener('click', deleteSelectedCards);

    // Member Batch Buttons
    document.getElementById('btn-remove-members').addEventListener('click', removeSelectedMembers);

    // Assign Task Button
    document.getElementById('btn-assign-task').addEventListener('click', assignExtraTask);

    // Modal close listeners
    document.querySelectorAll('.modal-close, .modal-close-btn, .modal-overlay').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.className === 'modal-close' || 
                e.target.classList.contains('modal-close-btn') || 
                e.target.classList.contains('modal-overlay')) {
                const openOverlay = e.target.closest('.modal-overlay');
                if (openOverlay) openOverlay.classList.remove('active');
                
                // If closing camera modal, stop camera
                if (openOverlay && openOverlay.id === 'modal-camera-scanner') {
                    stopCameraScanner();
                }
            }
        });
    });

    // Confirm submit button binding
    document.getElementById('btn-confirm-submit').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
    });
});

