
let currentGraphic = null;
let userPhotoData = null;

const TEMPLATE_CONFIG = {
    userPhoto: {
        x: 225,       
        y: 685,        
        width: 1140,    
        height: 1140,   
        style: 'rounded', 
        borderRadius: 60
    },
    userName: {
        x: 1450,        
        y: 900,        
        font: 'bold 180px Bebas Neue',
        color: '#000000',
        align: 'left',
        maxWidth: 2000,
        maxHeight: 120,
        lineHeight: 70
    },
}

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupMobileOptimizations();
});

function initializeApp() {
    setupFileUpload();
    preloadFonts();
}

function preloadFonts() {
    const fontLink = document.createElement('link');
    fontLink.rel = 'preload';
    fontLink.as = 'font';
    fontLink.type = 'font/woff2';
    fontLink.crossOrigin = 'anonymous';
    fontLink.href = 'https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2';
    document.head.appendChild(fontLink);
    
    const font = new FontFace('Bebas Neue', 'url(https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2)');
    font.load().then(() => {
        document.fonts.add(font);
    }).catch((error) => {
        console.warn('Could not load Bebas Neue font:', error);
    });
}

function setupEventListeners() {
    const photoInput = document.getElementById('photo');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoUpload);
    }

    const nameInput = document.getElementById('name');
    
    if (nameInput) {
        nameInput.addEventListener('input', updatePreview);
    }
}

function setupFileUpload() {
    const fileUploadArea = document.getElementById('file-upload-area');
    const photoInput = document.getElementById('photo');
    
    if (fileUploadArea && photoInput) {
        fileUploadArea.addEventListener('click', () => {
            photoInput.click();
        });
        
        fileUploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });
        
        fileUploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
        });
        
        fileUploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                photoInput.files = files;
                handlePhotoUpload({ target: { files: files } });
            }
        });
    }
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    const photoPreview = document.getElementById('photo-preview');
    const fileUploadArea = document.getElementById('file-upload-area');
    
    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('Image file size should be less than 5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            userPhotoData = e.target.result;
            if (fileUploadArea) {
                fileUploadArea.style.display = 'none';
            }
            if (photoPreview) {
                photoPreview.style.display = 'block';
                photoPreview.innerHTML = `<img src="${e.target.result}" alt="Profile Photo" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px;">`;
            }
            
            updatePreview();
        };
        reader.readAsDataURL(file);
    }
}

function updatePreview() {
    const name = document.getElementById('name').value.trim();
    
    currentGraphic = {
        name: name || 'Your Name',
        photo: userPhotoData
    };
    
}

function generateAndDownload() {
    const name = document.getElementById('name').value.trim();
    const photoFile = document.getElementById('photo').files[0];
    
    if (!name) {
        alert('Please enter your name');
        document.getElementById('name').focus();
        return;
    }
    
    currentGraphic = {
        name: name,
        photo: userPhotoData
    };
    
    
    generateBadgeWithTemplate();
}

function getTemplatePath() {
    return 'assets/template.jpg';
}

function generateBadgeWithTemplate() {
    const generateBtn = document.querySelector('.generate-btn');
    const originalText = generateBtn.innerHTML;
    
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Badge...';
    generateBtn.disabled = true;
    
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const templateImg = new Image();
        templateImg.onload = function() {
            canvas.width = templateImg.width;
            canvas.height = templateImg.height;
            
            
            ctx.drawImage(templateImg, 0, 0);
            
            addUserDataToCanvas(ctx, canvas, function() {
                downloadCanvas(canvas);
                generateBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded!';
                generateBtn.style.background = '#10b981';
                generateBtn.disabled = false;
                
                setTimeout(() => {
                    generateBtn.innerHTML = originalText;
                    generateBtn.style.background = '';
                }, 2000);
            });
        };
        
        templateImg.onerror = function() {
            console.error('Failed to load template image');
            alert('Failed to load template. Please check if the template file exists.');
            
            generateBtn.innerHTML = originalText;
            generateBtn.disabled = false;
        };
        
        const templatePath = getTemplatePath();
        templateImg.src = templatePath;
        
    } catch (error) {
        console.error('Badge generation failed:', error);
        alert('Failed to generate badge. Please try again.');
        
        generateBtn.innerHTML = originalText;
        generateBtn.disabled = false;
    }
}

function addUserDataToCanvas(ctx, canvas, callback) {
    let tasksCompleted = 0;
    const totalTasks = currentGraphic.photo ? 2 : 1; // Photo + Text or just Text
    
    function checkCompletion() {
        tasksCompleted++;
        if (tasksCompleted >= totalTasks) {
            callback();
        }
    }
    
    if (currentGraphic.photo) {
        const userImg = new Image();
        userImg.onload = function() {
            drawUserPhoto(ctx, userImg);
            checkCompletion();
        };
        userImg.onerror = function() {
            console.error('Failed to load user photo');
            checkCompletion();
        };
        userImg.src = currentGraphic.photo;
    }
    
    drawUserText(ctx);
    checkCompletion();
}

function drawUserPhoto(ctx, userImg) {
    const config = TEMPLATE_CONFIG.userPhoto;
    
    
    ctx.save();
    
    if (config.style === 'circle') {
        ctx.beginPath();
        ctx.arc(
            config.x + config.width / 2, 
            config.y + config.height / 2, 
            config.width / 2, 
            0, 
            2 * Math.PI
        );
        ctx.clip();
    } else if (config.style === 'rounded') {
        const radius = config.borderRadius || 20;
        ctx.beginPath();
        ctx.roundRect(config.x, config.y, config.width, config.height, radius);
        ctx.clip();
    } else {
        ctx.beginPath();
        ctx.rect(config.x, config.y, config.width, config.height);
        ctx.clip();
    }
    
    const scale = Math.max(config.width / userImg.width, config.height / userImg.height);
    const scaledWidth = userImg.width * scale;
    const scaledHeight = userImg.height * scale;
    
    const drawX = config.x + (config.width - scaledWidth) / 2;
    const drawY = config.y + (config.height - scaledHeight) / 2;
    
    ctx.drawImage(userImg, drawX, drawY, scaledWidth, scaledHeight);
    
    ctx.restore();
}

function drawUserText(ctx) {
    const nameConfig = TEMPLATE_CONFIG.userName;
    
    ctx.fillStyle = nameConfig.color;
    
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    
    const fontString = `${nameConfig.font}, Arial, sans-serif`;
    ctx.font = fontString;
    ctx.textAlign = nameConfig.align;
    
    const uppercaseName = currentGraphic.name.toUpperCase();
    
    const fontPromise = document.fonts.ready;
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1000)); // 1 second timeout
    
    Promise.race([fontPromise, timeoutPromise]).then(() => {
        ctx.font = fontString;
        ctx.textAlign = nameConfig.align;
        
        drawWrappedText(ctx, uppercaseName, nameConfig);
    }).catch((error) => {
        console.error('Font loading failed:', error);
        drawWrappedText(ctx, uppercaseName, nameConfig);
    });
}

function drawWrappedText(ctx, text, config) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    const fontString = `${config.font}, Arial, sans-serif`;
    ctx.font = fontString;
    
    for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + (currentLine ? ' ' : '') + words[i];
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > config.maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    let y = config.y;
    for (let i = 0; i < lines.length; i++) {
        if (y > config.y + config.maxHeight) {
            break;
        }
        
        ctx.strokeText(lines[i], config.x, y);
        ctx.fillText(lines[i], config.x, y);
        y += config.lineHeight;
    }
    
}

function downloadCanvas(canvas) {
    try {
        const link = document.createElement('a');
        link.download = `blockfest-badge-${currentGraphic.name.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        
        setTimeout(() => {
            clearAllInputs();
        }, 1500); // 1.5 second delay to show success state
        
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download badge. Please try again.');
    }
}

function clearAllInputs() {
    const formOverlay = document.querySelector('.glossy-form-overlay');
    if (formOverlay) {
        formOverlay.style.opacity = '0.7';
        formOverlay.style.transition = 'opacity 0.3s ease';
    }
    
    setTimeout(() => {
        const nameInput = document.getElementById('name');
        if (nameInput) {
            nameInput.value = '';
        }
        
        const photoInput = document.getElementById('photo');
        const photoPreview = document.getElementById('photo-preview');
        const fileUploadArea = document.getElementById('file-upload-area');
        
        if (photoInput) {
            photoInput.value = '';
        }
        
        if (photoPreview) {
            photoPreview.style.display = 'none';
            photoPreview.innerHTML = '';
        }
        
        if (fileUploadArea) {
            fileUploadArea.style.display = 'block';
        }
        
        userPhotoData = null;
        currentGraphic = null;
        
        const generateBtn = document.querySelector('.generate-btn');
        if (generateBtn) {
            generateBtn.innerHTML = '<i class="fas fa-download"></i> Generate My Badge';
            generateBtn.disabled = false;
            generateBtn.style.background = '';
        }
        
        if (formOverlay) {
            formOverlay.style.opacity = '1';
        }
        
    }, 200);
}

function validateForm() {
    const name = document.getElementById('name').value.trim();
    
    if (!name) {
        alert('Please enter your name');
        return false;
    }
    
    return true;
}

function setupMobileOptimizations() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                const viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) {
                    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                }
            }
        });
        
        input.addEventListener('blur', function() {
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                const viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) {
                    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                }
            }
        });
    });
    
    const generateBtn = document.querySelector('.generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('touchstart', function(e) {
            this.style.transform = 'scale(0.98)';
        });
        
        generateBtn.addEventListener('touchend', function(e) {
            this.style.transform = '';
        });
    }
    
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const generateBtn = document.querySelector('.generate-btn');
        if (generateBtn && !generateBtn.disabled) {
            generateAndDownload();
        }
    }
});
