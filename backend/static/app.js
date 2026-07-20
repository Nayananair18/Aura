// Tab management
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Find clicked tab button and activate it
  const clickedBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.innerText.toLowerCase().includes(tabId.replace('feed', 'verification').replace('lookup', 'resolver')));
  if (clickedBtn) clickedBtn.classList.add('active');
  
  const targetContent = document.getElementById(`tab-${tabId}`);
  if (targetContent) targetContent.classList.add('active');

  if (tabId === 'feed') {
    loadVerificationsFeed();
  } else if (tabId === 'analytics') {
    loadAnalytics();
  }
}

// Preset Sensor Telemetry configurations
const presets = {
  natural: {
    lux: 850,
    emf: 45,
    moire: 0.05,
    pwm: 0.02,
    grav: 9.8,
  },
  monitor: {
    lux: 210,
    emf: 185,
    moire: 0.75,
    pwm: 0.15,
    grav: 9.8,
  },
  flicker: {
    lux: 150,
    emf: 65,
    moire: 0.1,
    pwm: 0.78,
    grav: 9.8,
  },
  gravity: {
    lux: 300,
    emf: 40,
    moire: 0.05,
    pwm: 0.02,
    grav: 0.0,
  },
  custom: {}
};

let currentPreset = 'natural';

function setPreset(presetName) {
  currentPreset = presetName;
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('active', 'active-danger');
  });

  const btnId = `preset-${presetName}`;
  const btnEl = document.getElementById(btnId);
  
  if (presetName !== 'custom') {
    const config = presets[presetName];
    document.getElementById('input-lux').value = config.lux;
    document.getElementById('input-emf').value = config.emf;
    document.getElementById('input-moire').value = config.moire;
    document.getElementById('input-pwm').value = config.pwm;
    document.getElementById('input-grav').value = config.grav;
    
    // Add color class
    if (presetName === 'natural') {
      btnEl.classList.add('active');
    } else {
      btnEl.classList.add('active-danger');
    }
  } else {
    btnEl.classList.add('active');
  }
  
  updateSliders();
}

function updateSliders() {
  const lux = document.getElementById('input-lux').value;
  const emf = document.getElementById('input-emf').value;
  const moire = document.getElementById('input-moire').value;
  const pwm = document.getElementById('input-pwm').value;
  const grav = document.getElementById('input-grav').value;

  document.getElementById('val-lux').innerText = lux;
  document.getElementById('val-emf').innerText = emf;
  document.getElementById('val-moire').innerText = moire;
  document.getElementById('val-pwm').innerText = pwm;
  document.getElementById('val-grav').innerText = grav;

  // HUD Overlay updates
  document.getElementById('hud-lux').innerText = lux;
  document.getElementById('hud-emf').innerText = emf;
  document.getElementById('hud-grav').innerText = `[0.0, 0.0, ${grav}]`;
}

// Generate base64 canvas image to simulate physical camera output
function generateMockImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  
  // Create beautiful tech grid or cyber lens layout
  ctx.fillStyle = '#070a13';
  ctx.fillRect(0, 0, 640, 480);
  
  // Radial grid circle lines
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(320, 240, 180, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(320, 240, 80, 0, Math.PI * 2);
  ctx.stroke();
  
  // Crosshairs
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.beginPath();
  ctx.moveTo(320, 40);
  ctx.lineTo(320, 440);
  ctx.moveTo(80, 240);
  ctx.lineTo(560, 240);
  ctx.stroke();

  // Watermark placeholder box overlay
  ctx.fillStyle = 'rgba(34, 211, 238, 0.03)';
  ctx.fillRect(490, 335, 130, 130);
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.3)';
  ctx.strokeRect(490, 335, 130, 130);

  // Reality Stamp watermark text
  ctx.fillStyle = 'rgba(34, 211, 238, 0.3)';
  ctx.font = '10px monospace';
  ctx.fillText("A.U.R.A. LENS v1.0", 30, 450);
  ctx.fillText(new Date().toUTCString(), 30, 465);

  return canvas.toDataURL('image/jpeg');
}

// Execute 4-step pipeline animation
async function executeCapturePipeline() {
  const captureBtn = document.getElementById('capture-seal-btn');
  captureBtn.disabled = true;
  
  // Reset nodes
  document.querySelectorAll('.node').forEach(n => n.classList.remove('active', 'completed'));
  document.getElementById('pipeline-progress').style.width = '0%';
  document.getElementById('capture-result-card').classList.remove('show');

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Step 1: Active - Environmental Telemetry fusion
  document.getElementById('step-1').classList.add('active');
  document.getElementById('pipeline-progress').style.width = '12.5%';
  await wait(450);
  document.getElementById('step-1').classList.remove('active');
  document.getElementById('step-1').classList.add('completed');
  
  // Step 2: Active - ML Anomaly screening
  document.getElementById('step-2').classList.add('active');
  document.getElementById('pipeline-progress').style.width = '37.5%';
  await wait(600);
  document.getElementById('step-2').classList.remove('active');
  document.getElementById('step-2').classList.add('completed');
  
  // Step 3: Active - Concatenating & SHA-256 fingerprint sealing
  document.getElementById('step-3').classList.add('active');
  document.getElementById('pipeline-progress').style.width = '62.5%';
  await wait(450);
  document.getElementById('step-3').classList.remove('active');
  document.getElementById('step-3').classList.add('completed');

  // Step 4: Active - QR injection and ledger dispatch stubs
  document.getElementById('step-4').classList.add('active');
  document.getElementById('pipeline-progress').style.width = '87.5%';
  
  // Collect state values
  const payload = {
    image_base64: generateMockImage(),
    device_fingerprint: "aura_dev_sim_fingerprint_9921",
    sensor_payload: {
      lux: parseFloat(document.getElementById('input-lux').value),
      magnetometer_uT: parseFloat(document.getElementById('input-emf').value),
      gravity_xyz: [0.0, 0.0, parseFloat(document.getElementById('input-grav').value)],
      pwm_score: parseFloat(document.getElementById('input-pwm').value),
      moire_score: parseFloat(document.getElementById('input-moire').value)
    },
    captured_at: new Date().toISOString()
  };

  try {
    const res = await fetch('/api/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'aura_dev_secret_key_2026'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    await wait(300);
    document.getElementById('step-4').classList.remove('active');
    document.getElementById('step-4').classList.add('completed');
    document.getElementById('pipeline-progress').style.width = '100%';

    displayResult(data, payload.sensor_payload);
  } catch (error) {
    alert("Sealing request failed: Make sure FastAPI backend is running.");
    console.error(error);
  } finally {
    captureBtn.disabled = false;
  }
}

// Display Sealing Result receipt
function displayResult(response, sensors) {
  const resultCard = document.getElementById('capture-result-card');
  const badge = document.getElementById('result-badge');
  const hashVal = document.getElementById('result-hash');
  const ledgerTxVal = document.getElementById('result-ledger-tx');
  const telemetryVal = document.getElementById('result-telemetry');
  const qrBox = document.getElementById('result-qr-box');
  const threatPanel = document.getElementById('result-threat-panel');
  const threatReasons = document.getElementById('result-threat-reasons');
  const detailsContent = document.getElementById('result-details-content');
  const downloadBtn = document.getElementById('download-btn');

  resultCard.classList.add('show');

  if (response.status === 'verified') {
    badge.className = 'status-badge success';
    badge.innerHTML = '✅ Verified Reality';
    
    hashVal.innerText = response.image_hash;
    ledgerTxVal.innerText = response.ledger_tx_hash;
    telemetryVal.innerText = `Light: ${sensors.lux} lm | EMF: ${sensors.magnetometer_uT} µT | Gravity: [0.0, 0.0, ${sensors.gravity_xyz[2]}] m/s²`;
    
    // Display QR Overlay URL representation
    qrBox.style.display = 'flex';
    qrBox.innerHTML = `<img src="/static/captures/${response.image_hash}.jpg" alt="Watermarked capture" style="border-radius: 6px; cursor: pointer;" onclick="inspectCapturedImage('${response.image_hash}')">`;
    
    // Enable download link
    downloadBtn.style.display = 'inline-flex';
    downloadBtn.href = response.download_url;
    
    detailsContent.style.display = 'grid';
    threatPanel.style.display = 'none';
  } else {
    badge.className = 'status-badge danger';
    badge.innerHTML = '🚨 Screen Spoof Blocked';
    
    // Hide details
    detailsContent.style.display = 'none';
    qrBox.style.display = 'none';
    downloadBtn.style.display = 'none';
    
    // Display threat descriptions
    threatPanel.style.display = 'flex';
    threatReasons.innerHTML = '';
    
    const reasons = response.ml_flags.reasons || ["Unknown anti-spoof rejection"];
    reasons.forEach(r => {
      const li = document.createElement('li');
      li.className = 'threat-item';
      li.innerText = r;
      threatReasons.appendChild(li);
    });
  }
}

function resetSimulator() {
  document.getElementById('capture-result-card').classList.remove('show');
  document.querySelectorAll('.node').forEach(n => n.classList.remove('active', 'completed'));
  document.getElementById('pipeline-progress').style.width = '0%';
  setPreset('natural');
}

// Load verification logs table
async function loadVerificationsFeed(statusFilter = '') {
  const tableBody = document.getElementById('feed-table-body');
  tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Querying trust ledger logs...</td></tr>`;

  try {
    let url = '/api/verifications';
    if (statusFilter && statusFilter !== 'all') {
      url += `?status=${statusFilter}`;
    }
    const res = await fetch(url);
    const verifications = await res.json();

    if (verifications.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No reality captures registered in ledger yet.</td></tr>`;
      return;
    }

    tableBody.innerHTML = '';
    verifications.forEach(v => {
      const row = document.createElement('tr');
      const formattedDate = new Date(v.captured_at).toLocaleString();
      const statusBadgeClass = v.status === 'verified' ? 'badge-row verified' : 'badge-row rejected';
      
      row.innerHTML = `
        <td>
          <div style="font-family: monospace; font-weight:600; color: var(--accent-cyan);">${v.image_hash.substring(0, 16)}...</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top:2px;">Captured: ${formattedDate}</div>
        </td>
        <td>
          <div style="font-size:0.85rem;">${v.device_model}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${v.organization_name}</div>
        </td>
        <td>
          <span class="${statusBadgeClass}">
            ${v.status === 'verified' ? 'verified' : 'rejected'}
          </span>
        </td>
        <td>
          <div style="font-size: 0.8rem;">EMF: <span style="color:#f43f5e">${v.sensor_payload.magnetometer_uT} µT</span></div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">Light: ${v.sensor_payload.lux} lm</div>
        </td>
        <td>
          <div style="font-size: 0.8rem;">Moiré Score: ${v.sensor_payload.moire_score ?? 0}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">PWM Score: ${v.sensor_payload.pwm_score ?? 0}</div>
        </td>
        <td>
          <button class="table-actions-btn" onclick="inspectCapturedImage('${v.image_hash}')">Inspect</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--accent-danger);">Error fetching verification records.</td></tr>`;
  }
}

function filterFeed(status) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`filter-${status}`).classList.add('active');
  loadVerificationsFeed(status);
}

// Inspect item audit popup
async function inspectCapturedImage(hash) {
  const modal = document.getElementById('detail-modal');
  const modalContent = document.getElementById('modal-body-content');
  modal.classList.add('show');
  
  modalContent.innerHTML = `<p style="color: var(--text-secondary);">Resolving cryptographic block audit data...</p>`;

  try {
    const res = await fetch(`/api/verify/${hash}`);
    if (!res.ok) throw new Error("Verification hash not resolved");
    const audit = await res.json();

    const formattedDate = new Date(audit.captured_at).toLocaleString();
    const formattedCreated = new Date(audit.created_at).toLocaleString();

    modalContent.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        <div>
          <h4 style="font-size:0.9rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.75rem;">Security Frame Snapshot</h4>
          <div style="border: 1px solid var(--border-color); border-radius:10px; overflow:hidden; background:#000; aspect-ratio:4/3;">
            <img src="/static/captures/${audit.image_hash}.jpg" style="width:100%; height:100%; object-fit:contain;">
          </div>
          <div style="margin-top: 1rem; display: flex; gap:10px;">
            <a href="/static/captures/${audit.image_hash}.jpg" class="btn" style="padding: 0.5rem 1rem; font-size: 0.8rem;" download>
              📥 Download Watermarked image
            </a>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap:1rem;">
          <h4 style="font-size:0.9rem; color:var(--text-muted); text-transform:uppercase;">Identity & Trust Metadata</h4>
          
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:0.72rem; color:var(--text-muted);">IMAGE HASH (SHA-256)</span>
            <span style="font-family:monospace; font-size:0.85rem; word-break:break-all; color:var(--accent-cyan);">${audit.image_hash}</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:0.72rem; color:var(--text-muted);">LEDGER TRANSACTION (POLYGON)</span>
            <span style="font-family:monospace; font-size:0.85rem; word-break:break-all; color:#c084fc;">${audit.ledger_tx_hash || 'Unanchored'}</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:0.72rem; color:var(--text-muted);">ISSUING CLIENT ORG</span>
            <span style="font-size:0.88rem; font-weight:600;">${audit.organization_name}</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:0.72rem; color:var(--text-muted);">TRUST ANCHOR CAPTURED DEVICE</span>
            <span style="font-size:0.88rem;">${audit.device_model}</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:0.72rem; color:var(--text-muted);">SHUTTER TIMESTAMP</span>
            <span style="font-size:0.88rem;">${formattedDate}</span>
          </div>

          <div style="border-top:1px solid var(--border-color); padding-top:1rem; margin-top:0.5rem;">
            <h4 style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">Sensor Payload Vector</h4>
            <pre style="background:var(--bg-secondary); border: 1px solid var(--border-color); border-radius:6px; padding:10px; font-family:monospace; font-size:0.75rem; color:#a7f3d0; overflow-x:auto;">${JSON.stringify(audit.sensor_payload, null, 2)}</pre>
          </div>
        </div>
      </div>
    `;

  } catch (error) {
    modalContent.innerHTML = `<p style="color:var(--accent-danger);">Failed to resolve verification details.</p>`;
  }
}

function closeModal(event) {
  document.getElementById('detail-modal').classList.remove('show');
}

// Public signature resolver/lookup
async function resolveHash() {
  const hash = document.getElementById('lookup-hash-input').value.trim();
  const card = document.getElementById('lookup-result-card');
  
  if (!hash) {
    alert("Please enter a valid 64-character hex hash signature.");
    return;
  }

  card.style.display = 'block';
  card.innerHTML = `<p style="color: var(--text-secondary);">Querying trust registers...</p>`;

  try {
    const res = await fetch(`/api/verify/${hash}`);
    if (res.status === 404) {
      card.innerHTML = `
        <div class="threat-panel" style="margin-top:0;">
          <div class="threat-title">❌ Verification Signature Not Found</div>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top:5px;">
            This SHA-256 fingerprint does not exist in the platform repository. The image has either been tampered with or was not generated by an authorized device.
          </p>
        </div>
      `;
      return;
    }
    
    const audit = await res.json();
    const formattedDate = new Date(audit.captured_at).toLocaleString();
    
    card.innerHTML = `
      <div class="result-header">
        <h4 style="font-size: 1.1rem; font-weight: 600;">Resolved Reality Profile</h4>
        <div class="status-badge success">✅ Trust Verified</div>
      </div>
      <div class="result-details">
        <div class="result-info">
          <div class="info-row">
            <div class="info-label">Issuer Organization</div>
            <div class="info-value bold">${audit.organization_name}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Capture Timestamp</div>
            <div class="info-value">${formattedDate}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Capture Device Model</div>
            <div class="info-value">${audit.device_model}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Ledger Tx (Polygon)</div>
            <div class="info-value" style="color: #c084fc;">${audit.ledger_tx_hash}</div>
          </div>
        </div>
        <div class="result-qr" style="display:flex;">
          <img src="/static/captures/${audit.image_hash}.jpg">
        </div>
      </div>
    `;

  } catch (error) {
    card.innerHTML = `<p style="color: var(--accent-danger);">Lookup query error.</p>`;
  }
}

// Chart.js references
let threatChartInstance = null;
let sensorChartInstance = null;

// Load Fraud Analytics tab statistics & Chart rendering
async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    const data = await res.json();

    // Set stats panels values
    document.getElementById('stat-integrity').innerText = `${data.summary.integrity_score}%`;
    document.getElementById('stat-verified').innerText = data.summary.verified;
    document.getElementById('stat-rejected').innerText = data.summary.rejected;
    document.getElementById('stat-total').innerText = data.summary.total_attempts;

    // Adjust success/danger styling for Integrity Index
    const integrityEl = document.getElementById('stat-integrity');
    if (data.summary.integrity_score < 70) {
      integrityEl.className = 'stat-value danger';
    } else {
      integrityEl.className = 'stat-value success';
    }

    // Chart 1: Threat Vectors Doughnut
    const threatCtx = document.getElementById('threatChart').getContext('2d');
    if (threatChartInstance) {
      threatChartInstance.destroy();
    }
    
    threatChartInstance = new Chart(threatCtx, {
      type: 'doughnut',
      data: {
        labels: ['PWM Flicker Anomaly', 'Moiré Grid Pattern', 'EMF Spoofing', 'Gravity/Tilt Violations'],
        datasets: [{
          data: [
            data.attack_vectors.pwm_flicker,
            data.attack_vectors.moire_pattern,
            data.attack_vectors.emf_anomaly,
            data.attack_vectors.gravity_violations
          ],
          backgroundColor: ['#7c3aed', '#f43f5e', '#ef4444', '#f59e0b'],
          borderColor: '#0c1020',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { family: 'Space Grotesk' } }
          }
        }
      }
    });

    // Chart 2: Reality Verification balance bar
    const sensorCtx = document.getElementById('sensorBalanceChart').getContext('2d');
    if (sensorChartInstance) {
      sensorChartInstance.destroy();
    }
    
    sensorChartInstance = new Chart(sensorCtx, {
      type: 'bar',
      data: {
        labels: ['Verified Captures', 'Blocked Spoofs'],
        datasets: [{
          label: 'Total Shots',
          data: [data.summary.verified, data.summary.rejected],
          backgroundColor: ['#22d3ee', '#f43f5e'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', stepSize: 1 } }
        }
      }
    });

  } catch (error) {
    console.error("Failed to load fraud statistics", error);
  }
}

// Initial initialization trigger
document.addEventListener('DOMContentLoaded', () => {
  updateSliders();
  
  // Set Android Simulated Clock Time dynamically
  const timeEl = document.getElementById('android-time');
  if (timeEl) {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // key 0 to 12
      timeEl.innerText = `${hours}:${minutes} ${ampm}`;
    };
    updateClock();
    setInterval(updateClock, 60000);
  }
});
