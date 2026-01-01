// ============================================
// Global Variables
// ============================================

// Camera and card scanning
let frontImage = null;
let scannedCards = [];

// Browse functionality
let allBrowseCards = [];
let offset = 0;
const LIMIT = 24;
let isLoading = false;

// Authentication
let currentUser = null;
let authMode = 'login';
let hasSubscription = false;
let subscriptionTier = 0;
let pendingAuthEmail = null;

// Filters
let filterSeries = '';
let filterMinPrice = '';
let filterMaxPrice = '';

// Price slider state
let minPrice = 0;
let maxPrice = 10000;
let isDragging = false;
let activeHandle = null;

// Terms acceptance state
let termsAccepted = false;

// ============================================
// Function Definitions
// ============================================

function updateScanned() {
    const el = document.getElementById('scannedCards');
    if (scannedCards.length === 0) {
        el.innerHTML = '<div style="color: #71717a; text-align: center; padding: 20px;">No cards scanned yet</div>';
        return;
    }
    
    el.innerHTML = '';
    scannedCards.forEach((card, idx) => {
        const div = document.createElement('div');
        div.className = 'card-item';
        const price = card.estimated_price || card.estimatedPrice || 0;
        div.innerHTML = `
            <div class="card-name">${card.name || 'Unknown'}</div>
            <div class="card-series">${card.series || 'Unknown Series'}</div>
            <div class="card-price">${price ? price.toLocaleString() : '0'}</div>
        `;
        div.onclick = () => showScannedDetail(idx);
        el.appendChild(div);
    });
}

function showScannedDetail(idx) {
    const card = scannedCards[idx];
    if (!card) return;
    showModal(card);
}

async function loadCards() {
    if (isLoading) return;
    isLoading = true;
    
    document.getElementById('loading').style.display = 'block';
    const searchValue = document.getElementById('searchBarOverlay').value || '';
    const params = new URLSearchParams({
        search: searchValue,
        offset: offset,
        limit: LIMIT
    });

    try {
        const response = await fetch(`https://api-xbll.onrender.com/browse?${params}`, {
            method: "GET",
            credentials: "include"
        });
        const cards = await response.json();
        const grid = document.getElementById('cardsGrid');
        
        cards.forEach((card) => {
            allBrowseCards.push(card);
            const cardIndex = allBrowseCards.length - 1;
            
            const el = document.createElement('div');
            el.className = 'card-item';
            const imageUrl = card.img1_url || card.image_1_url;
            if (imageUrl) {
                el.classList.add('has-image');
                el.style.backgroundImage = `url(https://api-xbll.onrender.com${imageUrl})`;
            }
            const price = card.estimated_price || card.estimatedPrice || 0;
            el.innerHTML = `
                <div class="card-name">${card.name}</div>
                <div class="card-series">${card.series}</div>
                <div class="card-price">${price ? price.toLocaleString() : '0'}</div>
            `;
            el.onclick = () => showCardDetail(cardIndex);
            grid.appendChild(el);
        });
        
        offset += cards.length;
        
        if (cards.length === LIMIT) {
            const browseTab = document.getElementById('browseTab');
            if (browseTab.scrollHeight <= browseTab.clientHeight) {
                setTimeout(() => loadCards(), 100);
            }
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        isLoading = false;
        document.getElementById('loading').style.display = 'none';
    }
}

function showCardDetail(cardIndex) {
    const card = allBrowseCards[cardIndex];
    if (!card) return;
    showModal(card);
}

function showModal(card) {
    const modal = document.getElementById('cardModal');
    const body = document.getElementById('modalBody');
    
    const price = card.estimated_price || card.estimatedPrice || 0;
    const img1 = card.img1_url || card.image_1_url;
    const img2 = card.img2_url || card.image_2_url;
    
    body.innerHTML = `
        <div class="modal-images">
            ${img1 ? `<img src="https://api-xbll.onrender.com${img1}" class="modal-image" alt="Front">` : '<div class="modal-image" style="background: #272833;"></div>'}
            ${img2 ? `<img src="https://api-xbll.onrender.com${img2}" class="modal-image" alt="Back">` : '<div class="modal-image" style="background: #272833;"></div>'}
        </div>
        <div class="modal-info">
            <h2 class="modal-title">${card.name || 'Unknown Card'}</h2>
            <div class="modal-detail">
                <span class="modal-label">Series</span>
                <span class="modal-value">${card.series || 'Unknown'}</span>
            </div>
            ${card.foil_effect ? `
            <div class="modal-detail">
                <span class="modal-label">Foil Effect</span>
                <span class="modal-value">${card.foil_effect}</span>
            </div>` : ''}
            ${card.parallel !== undefined && card.parallel !== null ? `
            <div class="modal-detail">
                <span class="modal-label">Parallel</span>
                <span class="modal-value">${card.parallel}</span>
            </div>` : ''}
            ${card.score !== undefined && card.score !== null ? `
            <div class="modal-detail">
                <span class="modal-label">Score</span>
                <span class="modal-value">${card.score}</span>
            </div>` : ''}
            <div class="modal-price-big">${price ? price.toLocaleString() : '0'}</div>
            ${card.description ? `<div class="modal-description">${card.description}</div>` : ''}
        </div>
    `;
    
    modal.classList.add('show');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tab + 'Tab').classList.add('active');
    document.getElementById('nav' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');

    const filterBtn = document.getElementById('filterBtn');
    const searchIconBtn = document.getElementById('searchIconBtn');
    if (tab === 'browse') {
        filterBtn.style.display = 'block';
        searchIconBtn.style.display = 'block';
    } else {
        filterBtn.style.display = 'none';
        searchIconBtn.style.display = 'none';
    }

    const sideBtn = document.getElementById('sideToggle');
    if (tab === 'capture') {
        sideBtn.style.display = 'block';
    } else {
        sideBtn.style.display = 'none';
        document.getElementById('sideMenu').classList.remove('open');
        document.getElementById('sideOverlay').classList.remove('show');
        sideBtn.classList.remove('open');
        sideBtn.textContent = '◀';
    }

    if (tab === 'browse' && offset === 0) {
        loadCards();
    }
}

function updateAuthUI() {
    const profilePic = document.getElementById('profilePic');
    const profileEmail = document.getElementById('profileEmail');
    const accountEmailDisplay = document.getElementById('accountEmailDisplay');
    const authLogo = document.getElementById('authLogo');

    if (currentUser) {
        profilePic.style.display = 'flex';
        profilePic.textContent = currentUser.charAt(0).toUpperCase();
        profileEmail.textContent = currentUser;
        if (accountEmailDisplay) {
            accountEmailDisplay.textContent = currentUser;
        }
        document.getElementById('authModal').classList.remove('show');
        if (authLogo) authLogo.style.display = 'none';
    } else {
        profilePic.style.display = 'none';
        document.getElementById('authModal').classList.add('show');
        if (authLogo) authLogo.style.display = 'block';
    }
    
    const planText = document.getElementById('subscriptionPlanText');
    if (planText) {
        const plans = {
            0: 'Free (No Subscription)',
            1: 'Normal Plan',
            2: 'Pro Plan', 
            3: 'Premium Plan'
        };
        planText.textContent = plans[subscriptionTier] || 'Free (No Subscription)';
    }
}

function updateSlider() {
    const slider = document.getElementById('priceSlider');
    const range = document.getElementById('priceRange');
    const minHandle = document.getElementById('minHandle');
    const maxHandle = document.getElementById('maxHandle');
    
    const minPercent = (minPrice / 10000) * 100;
    const maxPercent = (maxPrice / 10000) * 100;
    
    range.style.left = minPercent + '%';
    range.style.right = (100 - maxPercent) + '%';
    
    minHandle.style.left = minPercent + '%';
    maxHandle.style.left = maxPercent + '%';
    
    document.getElementById('filterMinPrice').value = minPrice;
    document.getElementById('filterMaxPrice').value = maxPrice;
}

function showPrompt(title, placeholder1, placeholder2, type1, type2) {
    return new Promise((resolve) => {
        const modal = document.getElementById('promptModal');
        const titleEl = document.getElementById('promptTitle');
        const input1 = document.getElementById('promptInput1');
        const input2 = document.getElementById('promptInput2');
        const confirmBtn = document.getElementById('promptConfirm');
        const cancelBtn = document.getElementById('promptCancel');
        
        titleEl.textContent = title;
        input1.placeholder = placeholder1;
        input2.placeholder = placeholder2;
        input1.type = type1;
        input2.type = type2;
        input1.value = '';
        input2.value = '';
        
        modal.classList.add('show');
        input1.focus();
        
        const cleanup = () => {
            modal.classList.remove('show');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        };
        
        confirmBtn.onclick = () => {
            const val1 = input1.value.trim();
            const val2 = input2.value.trim();
            cleanup();
            resolve(val1 && val2 ? { value1: val1, value2: val2 } : null);
        };
        
        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };
    });
}

function showNotification(message, type = 'warning') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function validateEmail(email) {
    if (!email || email.length > 254) return false;
    if ((email.match(/@/g) || []).length !== 1) return false;
    
    const [local, domain] = email.split('@');
    
    // Validate local part
    if (!local || local.length < 1 || local.length > 64) return false;
    if (local.startsWith('.') || local.endsWith('.')) return false;
    if (local.includes('..')) return false;
    if (local.includes(' ')) return false;
    if (local.includes('"')) return false;
    
    const localAllowed = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
    if (!localAllowed.test(local)) return false;
    
    // Validate domain part
    if (!domain || domain.length < 1 || domain.length > 253) return false;
    if (domain.includes(' ')) return false;
    if (domain.includes('..')) return false;
    
    const labels = domain.split('.');
    if (labels.length < 2) return false;
    
    // Validate TLD (last label)
    const tld = labels[labels.length - 1];
    if (tld.length < 2 || tld.length > 63) return false;
    if (!/^[a-zA-Z]+$/.test(tld)) return false;
    
    // Validate other domain labels
    for (let i = 0; i < labels.length - 1; i++) {
        const label = labels[i];
        if (label.length < 1 || label.length > 63) return false;
        if (label.startsWith('-') || label.endsWith('-')) return false;
        if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
    }
    
    return true;
}

function validatePassword(password) {
    return password.length >= 5;
}

function checkFormValidity() {
    const submitBtn = document.getElementById('authSubmit');
    
    if (authMode === 'signup') {
        const email = document.getElementById('authEmailSignup').value;
        const password = document.getElementById('authPasswordSignup').value;
        const emailValid = validateEmail(email);
        const passwordValid = validatePassword(password);
        submitBtn.disabled = !(emailValid && passwordValid && termsAccepted);
    } else {
        const email = document.getElementById('authEmailLogin').value;
        const password = document.getElementById('authPasswordLogin').value;
        const emailValid = validateEmail(email);
        const passwordValid = validatePassword(password);
        submitBtn.disabled = !(emailValid && passwordValid);
    }
}

// ============================================
// Event Handlers & Initialization
// ============================================

// Check for saved session
const savedUser = localStorage.getItem('packstorm_user');
const savedSubscription = localStorage.getItem('packstorm_subscription');
if (savedUser) {
    currentUser = savedUser;
    subscriptionTier = parseInt(savedSubscription) || 0;
    hasSubscription = subscriptionTier > 0;
}
updateAuthUI();

// Camera initialization
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
        document.getElementById('video').srcObject = stream;
    })
    .catch(() => console.log('Camera not available'));

// Capture button
document.getElementById('captureBtn').onclick = async () => {
    // DEBUG MODE: Using test images from local folder
    const DEBUG_MODE = true;
    
    if (DEBUG_MODE) {
        document.getElementById('scanStatus').textContent = 'Card added to queue';
        document.getElementById('scanStatus').style.display = 'block';
        
        setTimeout(() => {
            document.getElementById('scanStatus').style.display = 'none';
        }, 2000);
        
        const processingIndex = scannedCards.length;
        scannedCards.push({
            processing: true,
            name: 'Processing...',
            series: 'Analyzing card',
            estimated_price: null
        });
        updateScanned();
        
        try {
            const img1Response = await fetch('./image1.png');
            const img1Blob = await img1Response.blob();
            const img2Response = await fetch('./image2.png');
            const img2Blob = await img2Response.blob();
            
            const formData = new FormData();
            formData.append('image_1', new File([img1Blob], 'front.png', { type: 'image/png' }));
            formData.append('image_2', new File([img2Blob], 'back.png', { type: 'image/png' }));
            
            fetch('https://api-xbll.onrender.com/analyze', { 
                method: 'PUT',
                credentials: "include",
                body: formData
            })
                .then(response => response.text())
                .then(result => {
                    const trimmedResult = result.trim();
                    console.log('API result:', trimmedResult, 'Is failed:', trimmedResult === '0');
                    
                    if (trimmedResult === '0') {
                        scannedCards[processingIndex] = {
                            failed: true,
                            name: 'Analysis Failed',
                            series: 'Unable to identify card',
                            estimated_price: null
                        };
                    } else {
                        try {
                            const card = JSON.parse(trimmedResult);
                            scannedCards[processingIndex] = card;
                        } catch (err) {
                            scannedCards[processingIndex] = {
                                failed: true,
                                name: 'Parse Error',
                                series: 'Invalid response format',
                                estimated_price: null
                            };
                        }
                    }
                    updateScanned();
                })
                .catch(err => {
                    console.error('Error analyzing card:', err);
                    scannedCards[processingIndex] = {
                        failed: true,
                        name: 'Analysis Failed',
                        series: 'Connection error',
                        estimated_price: null
                    };
                    updateScanned();
                });
        } catch (err) {
            console.error('Error loading test images:', err);
            scannedCards[processingIndex] = {
                failed: true,
                name: 'Debug Error',
                series: 'Could not load test images',
                estimated_price: null
            };
            updateScanned();
        }
        
        return;
    }
    
    // ORIGINAL CODE: Camera capture
    const video = document.getElementById('video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    canvas.toBlob(blob => {
        if (!frontImage) {
            frontImage = blob;
            const status = document.getElementById('scanStatus');
            status.textContent = 'Turn the card around';
            status.style.display = 'block';
        } else {
            document.getElementById('scanStatus').textContent = 'Card added to queue';
            document.getElementById('scanStatus').style.display = 'block';
            
            setTimeout(() => {
                document.getElementById('scanStatus').style.display = 'none';
            }, 2000);
            
            const processingIndex = scannedCards.length;
            scannedCards.push({
                processing: true,
                name: 'Processing...',
                series: 'Analyzing card',
                estimated_price: null
            });
            updateScanned();
            
            const formData = new FormData();
            formData.append('image_1', frontImage, 'front.jpg');
            formData.append('image_2', blob, 'back.jpg');
            
            frontImage = null;
            
            fetch('http://127.0.0.1:8000/analyze', { 
                method: 'POST',
                body: formData
            })
                .then(response => response.text())
                .then(result => {
                    const trimmedResult = result.trim();
                    console.log('API result:', trimmedResult, 'Is failed:', trimmedResult === '0');
                    
                    if (trimmedResult === '0') {
                        scannedCards[processingIndex] = {
                            failed: true,
                            name: 'Analysis Failed',
                            series: 'Unable to identify card',
                            estimated_price: null
                        };
                    } else {
                        try {
                            const card = JSON.parse(trimmedResult);
                            scannedCards[processingIndex] = card;
                        } catch (err) {
                            scannedCards[processingIndex] = {
                                failed: true,
                                name: 'Parse Error',
                                series: 'Invalid response format',
                                estimated_price: null
                            };
                        }
                    }
                    updateScanned();
                })
                .catch(err => {
                    console.error('Error analyzing card:', err);
                    scannedCards[processingIndex] = {
                        failed: true,
                        name: 'Analysis Failed',
                        series: 'Connection error',
                        estimated_price: null
                    };
                    updateScanned();
                });
        }
    });
};

// Side menu toggle
document.getElementById('sideToggle').onclick = () => {
    const menu = document.getElementById('sideMenu');
    const overlay = document.getElementById('sideOverlay');
    const btn = document.getElementById('sideToggle');
    const header = document.getElementById('sideMenuHeader');
    
    menu.classList.toggle('open');
    overlay.classList.toggle('show');
    btn.classList.toggle('open');
    header.classList.toggle('open');
    btn.textContent = btn.classList.contains('open') ? '✕' : '◀';
};

// Side overlay click
document.getElementById('sideOverlay').onclick = () => {
    document.getElementById('sideToggle').click();
};

// Search icon button for small screens
document.getElementById('searchIconBtn').onclick = () => {
    document.getElementById('searchOverlay').style.display = 'flex';
    document.getElementById('logo').style.display = 'none';
    document.getElementById('searchIconBtn').style.display = 'none';
    document.getElementById('filterBtn').style.display = 'none';
    document.getElementById('profilePic').style.display = 'none';
    document.getElementById('searchBarOverlay').focus();
};

// Close search overlay
document.getElementById('closeSearchOverlay').onclick = () => {
    document.getElementById('searchOverlay').style.display = 'none';
    document.getElementById('logo').style.display = 'block';
    document.getElementById('searchIconBtn').style.display = 'block';
    document.getElementById('filterBtn').style.display = 'block';
    document.getElementById('profilePic').style.display = 'flex';
};

// Search overlay input
document.getElementById('searchBarOverlay').addEventListener('change', () => {
    const value = document.getElementById('searchBarOverlay').value;
    document.getElementById('searchBar').value = value;
    document.getElementById('searchBar').dispatchEvent(new Event('change'));
    document.getElementById('searchOverlay').style.display = 'none';
    offset = 0;
    allBrowseCards = [];
    document.getElementById('cardsGrid').innerHTML = '';
    loadCards();
});

// Search bar change
const searchBar = document.getElementById('searchBar');
if (searchBar) {
    searchBar.onchange = () => {
        offset = 0;
        allBrowseCards = [];
        document.getElementById('cardsGrid').innerHTML = '';
        loadCards();
    };
}

// Browse tab scroll
document.getElementById('browseTab').addEventListener('scroll', (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 500) {
        loadCards();
    }
});
document.getElementById('browseTab').addEventListener('scroll', (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 500) {
        loadCards();
    }
});

// Modal close button
document.getElementById('modalClose').onclick = () => {
    document.getElementById('cardModal').classList.remove('show');
};

// Modal background click
document.getElementById('cardModal').addEventListener('mousedown', (e) => {
    if (e.target === document.getElementById('cardModal')) {
        document.getElementById('cardModal').classList.remove('show');
    }
});

// Tab navigation - Capture
document.getElementById('navCapture').onclick = () => {
    switchTab('capture');
};

// Tab navigation - Browse
document.getElementById('navBrowse').onclick = () => {
    if (subscriptionTier < 1) {
        document.getElementById('subscriptionModal').classList.add('show');
        return;
    }
    switchTab('browse');
};

// Tab navigation - Collection
document.getElementById('navCollection').onclick = () => {
    if (subscriptionTier < 1) {
        document.getElementById('subscriptionModal').classList.add('show');
        return;
    }
    switchTab('collection');
};

// Subscription modal close
document.getElementById('subscriptionClose').onclick = () => {
    document.getElementById('subscriptionModal').classList.remove('show');
};

// Select Normal subscription button
document.getElementById('selectNormalBtn').onclick = () => {
    document.getElementById('paymentOptionsModal').classList.add('show');
    
    if (window.paypal) {
        document.getElementById('paypal-button-container').innerHTML = '';
        paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'gold'
            },
            createSubscription: function(data, actions) {
                return actions.subscription.create({
                    plan_id: 'P-18R598326J033122JNES35JI'
                });
            },
            onApprove: async function(data, actions) {
                try {
                    const response = await fetch(`https://api-xbll.onrender.com/subscription`, {
                        method: 'PUT',
                        credentials: 'include',
                        headers: { "Content-Type": "application/json" },
                        body: data.subscriptionID
                    });
                    
                    const result = await response.text();
                    const tier = parseInt(result);
                    
                    if (tier >= 1 && tier <= 3) {
                        subscriptionTier = tier;
                        hasSubscription = true;
                        localStorage.setItem('packstorm_subscription', result);
                        alert('Subscription activated successfully!');
                        document.getElementById('paymentOptionsModal').classList.remove('show');
                        document.getElementById('subscriptionModal').classList.remove('show');
                        updateAuthUI();
                    } else {
                        alert('Subscription activation failed. Please try again.');
                    }
                } catch (err) {
                    console.error('Subscription error:', err);
                    alert('Connection error. Please try again.');
                }
            },
            onError: function(err) {
                console.error('PayPal error:', err);
                alert('Payment error. Please try again.');
            }
        }).render('#paypal-button-container');
    }
};

// Payment options modal close
document.getElementById('paymentOptionsClose').onclick = () => {
    document.getElementById('paymentOptionsModal').classList.remove('show');
};

// Prompt modal helper
function showPrompt(title, placeholder1, placeholder2, type1, type2) {
    return new Promise((resolve) => {
        const modal = document.getElementById('promptModal');
        const titleEl = document.getElementById('promptTitle');
        const input1 = document.getElementById('promptInput1');
        const input2 = document.getElementById('promptInput2');
        const confirmBtn = document.getElementById('promptConfirm');
        const cancelBtn = document.getElementById('promptCancel');
        
        titleEl.textContent = title;
        input1.placeholder = placeholder1;
        input2.placeholder = placeholder2;
        input1.type = type1;
        input2.type = type2;
        input1.value = '';
        input2.value = '';
        
        modal.classList.add('show');
        input1.focus();
        
        const cleanup = () => {
            modal.classList.remove('show');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        };
        
        confirmBtn.onclick = () => {
            const val1 = input1.value.trim();
            const val2 = input2.value.trim();
            cleanup();
            resolve(val1 && val2 ? { value1: val1, value2: val2 } : null);
        };
        
        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };
    });
}

// Change Password
document.getElementById('changePasswordBtn').onclick = async () => {
    const result = await showPrompt(
        'Change Password',
        'Current Password',
        'New Password',
        'password',
        'password'
    );
    
    if (!result) return;
    
    try {
        const response = await fetch('https://api-xbll.onrender.com/change_password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: `${result.value1},${result.value2}`,
            credentials: 'include'
        });
        
        if (response.status === 200) {
            alert('Password changed successfully!');
        } else {
            alert('Failed to change password. Please check your current password.');
        }
    } catch (err) {
        console.error('Change password error:', err);
        alert('Connection error. Please try again.');
    }
};

// Change Email
document.getElementById('changeEmailBtn').onclick = async () => {
    const result = await showPrompt(
        'Change Email',
        'Current Password',
        'New Email',
        'password',
        'email'
    );
    
    if (!result) return;
    
    try {
        const response = await fetch('https://api-xbll.onrender.com/change_email', {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: `${result.value1},${result.value2}`,
            credentials: 'include'
        });
        
        if (response.status === 200) {
            currentUser = result.value2;
            localStorage.setItem('packstorm_user', result.value2);
            updateAuthUI();
            alert('Email changed successfully!');
        } else {
            alert('Failed to change email. Please check your password.');
        }
    } catch (err) {
        console.error('Change email error:', err);
        alert('Connection error. Please try again.');
    }
};

// Auth modal background click
document.getElementById('authModal').addEventListener('mousedown', (e) => {
    if (e.target === document.getElementById('authModal')) {
        // Do nothing - login is required
    }
});

// Terms checkbox
const termsCheckbox = document.getElementById('termsCheckbox');
termsCheckbox.addEventListener('click', () => {
    termsAccepted = !termsAccepted;
    const submitBtn = document.getElementById('authSubmit');
    if (termsAccepted) {
        termsCheckbox.style.background = 'white';
        termsCheckbox.style.opacity = '1';
    } else {
        termsCheckbox.style.background = 'rgba(228, 228, 231, 0.05)';
        termsCheckbox.style.opacity = '0.5';
    }
    checkFormValidity();
});

// Checkbox hover effect
termsCheckbox.addEventListener('mouseenter', () => {
    if (termsAccepted) {
        termsCheckbox.style.opacity = '0.75';
    } else {
        termsCheckbox.style.opacity = '0.75';
    }
});

termsCheckbox.addEventListener('mouseleave', () => {
    if (termsAccepted) {
        termsCheckbox.style.opacity = '1';
    } else {
        termsCheckbox.style.opacity = '0.5';
    }
});

// Auth submit button
document.getElementById('authSubmit').onclick = async () => {
    const email = authMode === 'login' ? document.getElementById('authEmailLogin').value : document.getElementById('authEmailSignup').value;
    const password = authMode === 'login' ? document.getElementById('authPasswordLogin').value : document.getElementById('authPasswordSignup').value;

    if (!email || !password) {
        showNotification('Please fill in all fields', 'warning');
        return;
    }

    if (authMode === 'signup' && !termsAccepted) {
        showNotification('Please accept the Terms of Service', 'warning');
        return;
    }

    const submitBtn = document.getElementById('authSubmit');
    submitBtn.disabled = true;

            const endpoint = authMode === 'login' ? '/login' : '/signup';
    const data = `${email},${password}`;

    try {
        const response = await fetch(`https://api-xbll.onrender.com${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: data,
            credentials: "include"
        });

        if (response.status === 200) {
            pendingAuthEmail = email;
            document.getElementById('authModal').classList.remove('show');
            document.getElementById('verifyCodeModal').classList.add('show');
            document.getElementById('verifyCodeInput').value = '';
            document.getElementById('verifyCodeError').style.display = 'none';
        } else if (response.status === 410) {
            alert('Login failed. Please check your credentials.');
        } else {
            showNotification('Request failed. Please try again.', 'error');
        }
    } catch (err) {
        console.error('Auth error:', err);
        showNotification('Connection error', 'error');
    } finally {
        submitBtn.disabled = false;
    }
};

// Profile picture click
document.getElementById('profilePic').onclick = () => {
    document.getElementById('profileDropdown').classList.toggle('show');
};

// Logout button
document.getElementById('logoutBtn').onclick = async () => {
    try {
        await fetch('https://api-xbll.onrender.com/logout', {
            method: 'GET',
            credentials: 'include'
        });
    } catch (err) {
        console.error('Logout error:', err);
    }
    
    currentUser = null;
    hasSubscription = false;
    subscriptionTier = 0;
    localStorage.removeItem('packstorm_user');
    localStorage.removeItem('packstorm_subscription');
    document.getElementById('profileDropdown').classList.remove('show');
    updateAuthUI();
    switchTab('capture');
};

// Settings button
document.getElementById('settingsBtn').onclick = () => {
    document.getElementById('profileDropdown').classList.remove('show');
    document.getElementById('settingsModal').classList.add('show');
};

// Settings modal close
document.getElementById('settingsClose').onclick = () => {
    document.getElementById('settingsModal').classList.remove('show');
};

// Settings navigation - Account
document.getElementById('navAccount').onclick = () => {
    document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    document.getElementById('navAccount').classList.add('active');
    document.getElementById('accountSection').classList.add('active');
};

// Settings navigation - Subscription
document.getElementById('navSubscription').onclick = () => {
    document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    document.getElementById('navSubscription').classList.add('active');
    document.getElementById('subscriptionSection').classList.add('active');
};

// View subscriptions button
document.getElementById('viewSubscriptionsBtn').onclick = () => {
    document.getElementById('settingsModal').classList.remove('show');
    document.getElementById('subscriptionModal').classList.add('show');
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('profileDropdown');
    const profilePic = document.getElementById('profilePic');
    if (!dropdown.contains(e.target) && !profilePic.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

// Filter button
document.getElementById('filterBtn').onclick = () => {
    document.getElementById('filterModal').classList.add('show');
    updateSlider();
};

// Filter modal close button
document.getElementById('filterClose').onclick = () => {
    document.getElementById('filterModal').classList.remove('show');
};

// Filter modal background click
document.getElementById('filterModal').addEventListener('mousedown', (e) => {
    if (e.target === document.getElementById('filterModal')) {
        document.getElementById('filterModal').classList.remove('show');
    }
});

// Price slider - Min handle mousedown
document.getElementById('minHandle').addEventListener('mousedown', (e) => {
    isDragging = true;
    activeHandle = 'min';
    e.preventDefault();
});

// Price slider - Max handle mousedown
document.getElementById('maxHandle').addEventListener('mousedown', (e) => {
    isDragging = true;
    activeHandle = 'max';
    e.preventDefault();
});

// Price slider - Mouse move
document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const slider = document.getElementById('priceSlider');
    const rect = slider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const value = Math.round((percent / 100) * 10000);
    
    if (activeHandle === 'min') {
        minPrice = Math.min(value, maxPrice - 100);
    } else {
        maxPrice = Math.max(value, minPrice + 100);
    }
    
    updateSlider();
});

// Price slider - Mouse up
document.addEventListener('mouseup', () => {
    isDragging = false;
    activeHandle = null;
});

// Filter apply button
document.getElementById('filterApply').onclick = () => {
    filterSeries = document.getElementById('filterSeries').value;
    filterMinPrice = minPrice > 0 ? minPrice : '';
    filterMaxPrice = maxPrice < 10000 ? maxPrice : '';
    
    offset = 0;
    allBrowseCards = [];
    document.getElementById('cardsGrid').innerHTML = '';
    document.getElementById('filterModal').classList.remove('show');
    loadCards();
};

// Filter clear button
document.getElementById('filterClear').onclick = () => {
    document.getElementById('filterSeries').value = '';
    minPrice = 0;
    maxPrice = 10000;
    filterSeries = '';
    filterMinPrice = '';
    filterMaxPrice = '';
    updateSlider();
    
    offset = 0;
    allBrowseCards = [];
    document.getElementById('cardsGrid').innerHTML = '';
    document.getElementById('filterModal').classList.remove('show');
    loadCards();
};

// Initialize default tab
switchTab('capture');

// Verify code back button (icon button)
document.getElementById('verifyCodeBackBtn').onclick = () => {
    document.getElementById('verifyCodeModal').classList.remove('show');
    document.getElementById('authModal').classList.add('show');
    pendingAuthEmail = null;
};

if (document.getElementById('verifyCodeClose')) {
    document.getElementById('verifyCodeClose').onclick = () => {
        document.getElementById('verifyCodeModal').classList.remove('show');
        pendingAuthEmail = null;
    };
}

// Auth toggle between login and signup
const authToggleBtn = document.getElementById('authToggle');
authToggleBtn.onclick = (e) => {
    e.preventDefault();
    const termsDiv = document.getElementById('termsCheckbox').parentElement;
    const signupInputs = document.getElementById('signupInputs');
    const loginInputs = document.querySelector('.auth-inputs:not(#signupInputs)');
    
    if (authMode === 'login') {
        authMode = 'signup';
        document.getElementById('authTitle').textContent = 'Sign Up';
        document.getElementById('authSubmit').textContent = 'Sign Up';
        document.getElementById('authToggleText').textContent = 'Already have an account? ';
        authToggleBtn.textContent = 'Login';
        loginInputs.style.display = 'none';
        signupInputs.style.display = 'block';
        termsDiv.style.display = 'flex';
    } else {
        authMode = 'login';
        document.getElementById('authTitle').textContent = 'Login';
        document.getElementById('authSubmit').textContent = 'Login';
        document.getElementById('authToggleText').textContent = "Don't have an account? ";
        authToggleBtn.textContent = 'Sign Up';
        loginInputs.style.display = 'block';
        signupInputs.style.display = 'none';
        termsDiv.style.display = 'none';
    }
    document.getElementById('authSubmit').disabled = true;
    checkFormValidity();
};

// Input change listeners
document.getElementById('authEmailLogin').addEventListener('input', checkFormValidity);
document.getElementById('authPasswordLogin').addEventListener('input', checkFormValidity);
document.getElementById('authEmailSignup').addEventListener('input', checkFormValidity);
document.getElementById('authPasswordSignup').addEventListener('input', checkFormValidity);

// Verify code submit button
document.getElementById('verifyCodeSubmit').onclick = async () => {
    const code = document.getElementById('verifyCodeInput').value;

    if (!code) {
        document.getElementById('verifyCodeError').textContent = 'Please enter the code';
        document.getElementById('verifyCodeError').style.display = 'block';
        return;
    }

    const submitBtn = document.getElementById('verifyCodeSubmit');
    submitBtn.disabled = true;
    document.getElementById('verifyCodeError').style.display = 'none';

    try {
        const password = authMode === 'signup' ? document.getElementById('authPasswordSignup').value : '';
        const body = authMode === 'signup' ? `${pendingAuthEmail},${code},${password}` : `${pendingAuthEmail},${code}`;
        
        const response = await fetch('https://api-xbll.onrender.com/verify_code', {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: body,
            credentials: 'include'
        });

        if (response.status === 200) {
            const result = await response.text();
            const tier = parseInt(result) || 0;
            
            currentUser = pendingAuthEmail;
            subscriptionTier = tier;
            hasSubscription = tier > 0;
            localStorage.setItem('packstorm_user', pendingAuthEmail);
            localStorage.setItem('packstorm_subscription', tier.toString());
            
            document.getElementById('verifyCodeModal').classList.remove('show');
            pendingAuthEmail = null;
            updateAuthUI();
        } else {
            document.getElementById('verifyCodeError').textContent = 'Code is wrong or has expired. Codes expire after 5 minutes';
            document.getElementById('verifyCodeError').style.display = 'block';
        }
    } catch (err) {
        console.error('Verify code error:', err);
        document.getElementById('verifyCodeError').textContent = 'Connection error. Please try again.';
        document.getElementById('verifyCodeError').style.display = 'block';
    } finally {
        submitBtn.disabled = false;
    }
};
