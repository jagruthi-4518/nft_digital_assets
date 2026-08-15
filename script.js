function normalizeLedger(rawLedger) {
    if (!Array.isArray(rawLedger)) return [];

    return rawLedger
        .filter(Boolean)
        .map((entry, index) => ({
            tokenId: Number.isFinite(entry?.tokenId) ? entry.tokenId : index + 1,
            contentHash: entry?.contentHash || '',
            assetName: entry?.assetName || `Asset ${index + 1}`,
            assetType: entry?.assetType || 'text',
            owner: entry?.owner || '—',
            mintedAt: Number.isFinite(entry?.mintedAt) ? entry.mintedAt : Math.floor(Date.now() / 1000),
            txHash: entry?.txHash || '',
            blockNumber: Number.isFinite(entry?.blockNumber) ? entry.blockNumber : null,
            tokenURI: entry?.tokenURI || '',
            cid: entry?.cid || ''
           
        }));
}

let provider;
let signer;
let contract;


const savedLedger = normalizeLedger(loadLedger());
const state = {
    hash: null,
    assetName: '',
    assetType: '',
    assetContent: '',
    fileData: null,
    verifyAssetType: '',
    verifyFileData: null,
    walletAddress: null,
    walletNetwork: null,
    chainId: null,
    ledger: savedLedger,
    nextTokenId: savedLedger.length ? Math.max(...savedLedger.map(item => Number(item.tokenId) || 0)) + 1 : 1,
    isSimulated: false,
    duplicateName: false,
    duplicateContent: false
};

const $ = (id) => document.getElementById(id);

const el = {
    assetName: $('assetName'),
    assetType: $('assetType'),
    assetContent: $('assetContent'),
    assetNameStatus: $('assetNameStatus'),
    assetTypeStatus: $('assetTypeStatus'),
    assetContentStatus: $('assetContentStatus'),
    assetFileStatus: $('assetFileStatus'),
    textInputGroup: $('textInputGroup'),
    fileDropGroup: $('fileDropGroup'),
    fileDropzone: $('fileDropzone'),
    fileInput: $('fileInput'),
    fileInfo: $('fileInfo'),
    fileTypeHint: $('fileTypeHint'),
    btnHash: $('btnHash'),
    hashResult: $('hashResult'),
    hashDisplay: $('hashDisplay'),
    hashMeta: $('hashMeta'),

    btnConnectWallet: $('btnConnectWallet'),
    btnMint: $('btnMint'),
    mintAssetName: $('mintAssetName'),
    mintAssetNamePreview: $('mintAssetNamePreview'),
    mintAssetHash: $('mintAssetHash'),
    mintTokenId: $('mintTokenId'),
    mintTxHash: $('mintTxHash'),
    mintBlockId: $('mintBlockId'),
    etherscanLink: $('etherscanLink'),
    mintWalletAddr: $('mintWalletAddr'),
    walletStatus: $('walletStatus'),
    walletCard: $('walletCard'),
    mintResult: $('mintResult'),
    nftCardPreview: $('nftCardPreview'),
    mintDetails: $('mintDetails'),

    blockchainRecord: $('blockchainRecord'),
    recordTokenId: $('recordTokenId'),
    recordAssetName:$('recordAssetName'),
    recordAssetType:$('recordAssetType'),
    recordContentHash: $('recordContentHash'),
    recordOwner: $('recordOwner'),
    recordTimestamp: $('recordTimestamp'),
    storageResult: $('storageResult'),
    blockVisual: $('blockVisual'),
    recordTxHash: $('recordTxHash'),

    verifyTokenId: $('verifyTokenId'),
    verifyAssetType: $('verifyAssetType'),
    verifyAssetTypeStatus: $('verifyAssetTypeStatus'),
    verifyContent: $('verifyContent'),
    verifyContentStatus: $('verifyContentStatus'),
    verifyTextInputGroup: $('verifyTextInputGroup'),
    verifyFileDropGroup: $('verifyFileDropGroup'),
    verifyFileDropzone: $('verifyFileDropzone'),
    verifyFileInput: $('verifyFileInput'),
    verifyFileInfo: $('verifyFileInfo'),
    verifyFileTypeHint: $('verifyFileTypeHint'),
    verifyFileStatus: $('verifyFileStatus'),
    btnVerify: $('btnVerify'),
    verifyResult: $('verifyResult'),
    verifyLabel: $('verifyLabel'),
    verifyOutput: $('verifyOutput'),

    ledgerCount: $('ledgerCount'),
    ledgerBody: $('ledgerBody'),

    mintCid: $('mintCid'),
    ipfsLink: $('ipfsLink')
};

function showResult(box) {
    box.classList.remove('hidden');
}

function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function createElement(tag, { className, text } = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function truncate(addr) {
    if (!addr) return '—';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function loadLedger() {
    try {
        const stored = localStorage.getItem('nftLedger');
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveLedger() {
    localStorage.setItem('nftLedger', JSON.stringify(state.ledger));
}

function formatTime(ts) {
    return new Date(ts * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function ipfsToHttp(ipfsUri) {
    if (!ipfsUri) return null;

    if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
        return ipfsUri;
    }

    if (ipfsUri.startsWith('ipfs://')) {
        return `https://ipfs.io/ipfs/${ipfsUri.slice(7)}`;
    }

    return ipfsUri;
}

function showLoading(message = 'Processing...') {
    const overlay = $('loadingOverlay');
    const loadingText = $('loadingText');
    if (!overlay || !loadingText) return;
    loadingText.textContent = message;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = $('loadingOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
}

async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return '0x' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function setInputStatus(element, message) {
    element.textContent = message || '';
    element.className = `input-status${message ? ' warning' : ''}`;
}

function updateDuplicateStatus() {
    const name = (el.assetName.value || '').trim();
    const ledgerEntries = Array.isArray(state.ledger) ? state.ledger : [];

    state.duplicateName = Boolean(name && ledgerEntries.some(item => (item?.assetName || '').toString().toLowerCase() === name.toLowerCase()));
    setInputStatus(el.assetNameStatus, state.duplicateName ? 'This asset name already exists.' : '');

    const hasContent = state.assetType === 'text' ? (el.assetContent.value || '').trim() : state.fileData;
    
    if (!hasContent) {
        state.duplicateContent = false;
        setInputStatus(el.assetContentStatus, '');
        setInputStatus(el.assetFileStatus, '');
        updateHashButtonState();
        return;
    }

    if (state.assetType === 'text') {
        const content = (el.assetContent.value || '').trim();
        sha256(content).then((hash) => {
            state.duplicateContent = ledgerEntries.some(item => (item?.contentHash || '').toString() === hash);
            setInputStatus(el.assetContentStatus, state.duplicateContent ? 'This content already exists.' : '');
            updateHashButtonState();
        }).catch(() => {
            state.duplicateContent = false;
            setInputStatus(el.assetContentStatus, '');
            updateHashButtonState();
        });
    } else if (state.fileData) {
        hashFileContent(state.fileData).then((hash) => {
            state.duplicateContent = ledgerEntries.some(item => (item?.contentHash || '').toString() === hash);
            setInputStatus(el.assetFileStatus, state.duplicateContent ? 'This file already exists.' : '');
            updateHashButtonState();
        }).catch(() => {
            state.duplicateContent = false;
            setInputStatus(el.assetFileStatus, '');
            updateHashButtonState();
        });
    }
}

function updateHashButtonState() {
    const hasInput = Boolean((el.assetName.value || '').trim() && 
        (state.assetType === 'text' ? (el.assetContent.value || '').trim() : state.fileData));
    const isBlocked = state.duplicateName || state.duplicateContent;
    el.btnHash.disabled = !hasInput || isBlocked;
    if (isBlocked) {
        el.btnHash.textContent = 'Duplicate asset';
    } else {
        el.btnHash.textContent = 'Generate SHA-256 Hash';
    }
}

function handleAssetTypeChange() {
    const assetType = el.assetType.value;
    state.assetType = assetType;

    // Reset file data and content
    state.fileData = null;
    el.assetContent.value = '';
    el.fileInfo.textContent = '';
    el.fileInfo.classList.add('empty');

    if (!assetType) {
        // Hide both input groups
        el.textInputGroup.classList.add('hidden');
        el.fileDropGroup.classList.add('hidden');
        setInputStatus(el.assetTypeStatus, 'Please select an asset type');
    } else if (assetType === 'text') {
        // Show text input, hide file drop
        el.textInputGroup.classList.remove('hidden');
        el.fileDropGroup.classList.add('hidden');
        setInputStatus(el.assetTypeStatus, '');
    } else {
        // Show file drop, hide text input
        el.textInputGroup.classList.add('hidden');
        el.fileDropGroup.classList.remove('hidden');
        
        // Set file type hint
        const fileHints = {
            'image': 'Supported: JPG, PNG, GIF, WebP, etc.',
            'doc': 'Supported: PDF, DOCX, TXT, etc.',
            'video': 'Supported: MP4, WebM, AVI, etc.'
        };
        el.fileTypeHint.textContent = fileHints[assetType] || '';
        setInputStatus(el.assetTypeStatus, '');
    }

    updateHashButtonState();
}

function handleFileSelect(file) {
    if (!file) return;

    const assetType = el.assetType.value;
    if (!assetType) {
        alert('Please select an asset type first.');
        return;
    }

    state.fileData = file;
    
    const fileSize = (file.size / 1024).toFixed(2);
    el.fileInfo.textContent = `📄 ${file.name} (${fileSize} KB)`;
    el.fileInfo.classList.remove('empty');
    
    updateHashButtonState();
}

function setupFileDropZone() {
    el.fileDropzone.addEventListener('click', () => {
        el.fileInput.click();
    });

    el.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Drag and drop events
    el.fileDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.fileDropzone.classList.add('drag-over');
    });

    el.fileDropzone.addEventListener('dragleave', () => {
        el.fileDropzone.classList.remove('drag-over');
    });

    el.fileDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        el.fileDropzone.classList.remove('drag-over');
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
}

async function hashFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buf = e.target.result;
                const hashBuf = await crypto.subtle.digest('SHA-256', buf);
                const hash = '0x' + Array.from(new Uint8Array(hashBuf))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                resolve(hash);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

function updateMintReadiness() {
    el.btnMint.disabled = !(state.hash && state.walletAddress);
    el.mintAssetName.textContent = state.assetName || '—';
    el.mintAssetHash.textContent = state.hash ? truncate(state.hash) : '—';
    if (el.btnConnectWallet) {
        el.btnConnectWallet.textContent = state.walletAddress ? 'Connected' : 'Connect MetaMask';
        el.btnConnectWallet.classList.toggle('connected', Boolean(state.walletAddress));
    }
    if (el.mintWalletAddr) {
        el.mintWalletAddr.textContent = state.walletAddress ? state.walletAddress : '—';
    }
    if (el.walletStatus) {
        el.walletStatus.textContent = state.walletAddress
            ? `${state.walletNetwork || 'Sepolia'}`
            : 'Not connected';
    }
}

async function connectWallet() {
    if (typeof window === 'undefined' || !window.ethereum) {
        alert('MetaMask is not installed. Please install it to continue.');
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || !accounts.length) throw new Error('No accounts returned');

        state.walletAddress = accounts[0];
        const targetChainId = '0xaa36a7';
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });

        if (currentChainId !== targetChainId) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetChainId }]
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: targetChainId,
                            chainName: 'Sepolia',
                            nativeCurrency: { name: 'Sepolia Ether', symbol: 'SEP', decimals: 18 },
                            rpcUrls: ['https://rpc.sepolia.org'],
                            blockExplorerUrls: ['https://sepolia.etherscan.io']
                        }]
                    });
                } else {
                    throw switchError;
                }
            }
        }

        state.chainId = await window.ethereum.request({ method: 'eth_chainId' });
        state.walletNetwork = 'Sepolia';

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            CONTRACT_ABI,
            signer
        );
        console.log("Smart contract connected?:", contract);

        updateMintReadiness();
    } catch (error) {
        console.error(error);
        alert('Unable to connect to MetaMask on Sepolia.');
    }
}





async function handleHash() {
    const name = el.assetName.value.trim();
    let hash;

    if (!name) return alert('Please enter an asset name.');
    if (!state.assetType) return alert('Please select an asset type.');
    if (state.duplicateName || state.duplicateContent) {
        alert('This asset name or content already exists in the ledger.');
        return;
    }

    if (state.assetType === 'text') {
        const content = el.assetContent.value.trim();
        if (!content) return alert('Please enter content.');
        hash = await sha256(content);
        state.assetContent = content;
    } else {
        if (!state.fileData) return alert('Please select a file.');
        hash = await hashFileContent(state.fileData);
        state.assetContent = `[${state.assetType.toUpperCase()} FILE: ${state.fileData.name}]`;
    }

    state.hash = hash;
    state.assetName = name;

    el.hashDisplay.textContent = hash;
    el.hashMeta.textContent = '';

    showResult(el.hashResult);
    updateMintReadiness();
}

async function uploadToBackend(assetName, contentHash, assetType, textContent, file) {
    if (assetType === 'text') {
        const res = await fetch('http://localhost:3001/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetName, assetType, content: textContent, contentHash })
        });
        if (!res.ok) throw new Error('Upload failed');
        return (await res.json());
    }

    const formData = new FormData();
    formData.append('assetName', assetName);
    formData.append('contentHash', contentHash);
    formData.append('assetType', assetType);
    formData.append('file', file);

    const res = await fetch('http://localhost:3001/api/upload-file', {
        method: 'POST',
        body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    return (await res.json());
}

async function handleMint() {
    if (!state.hash || !state.walletAddress) {
        alert('Please connect MetaMask first.');
        return;
    }

    if (!contract) {
        alert('Smart contract is not connected.');
        return;
    }

    if (state.duplicateName || state.duplicateContent) {
        alert('This asset name or content already exists.');
        return;
    }

    try {
        el.btnMint.disabled = true;
        el.btnMint.textContent = 'Waiting for MetaMask...';
        showLoading('Minting NFT...');

        console.log('Minting:', {
            assetName: state.assetName,
            contentHash: state.hash
        });

        showLoading('Uploading to IPFS...');
        const uploadResult = await uploadToBackend(
            state.assetName,
            state.hash,
            state.assetType,
            state.assetContent,
            state.fileData
        );
        const tokenURI = uploadResult.tokenURI;
        const metaCid = uploadResult.cid;

        showLoading('Minting NFT...');
        const tx = await contract.mintNFT(state.assetName, state.assetType, state.hash, tokenURI);

        console.log('Transaction submitted:', tx.hash);

        el.btnMint.textContent = 'Minting...';

        const receipt = await tx.wait();

        console.log('Transaction confirmed:', receipt);
        console.log('Receipt logs:', receipt.logs);

        let tokenId = null;

        // Look up the AssetMinted event by its topic hash rather than
        // trying to parse every log and swallowing failures. This makes
        // it obvious (via the thrown error) when the ABI/address in use
        // doesn't match what was actually deployed, instead of silently
        // failing to find a match after looping through everything.
        let assetMintedTopic;
        try {
            assetMintedTopic = contract.interface.getEvent('AssetMinted').topicHash;
        } catch (error) {
            console.error('AssetMinted event not found on contract interface. Check that ABI.js matches the deployed contract.', error);
            throw new Error('Contract ABI does not define an AssetMinted event.');
        }

        const matchingLog = receipt.logs.find(log => log.topics[0] === assetMintedTopic);

        if (!matchingLog) {
            console.error(
                'No AssetMinted log found in receipt. This usually means CONTRACT_ADDRESS or ABI.js ' +
                'is out of date (pointing at an older/different deployment). Logs received:',
                receipt.logs
            );
            throw new Error('Could not find Token ID in AssetMinted event.');
        }

        let parsedLog;
        try {
            parsedLog = contract.interface.parseLog(matchingLog);
        } catch (error) {
            console.error('Failed to parse matched AssetMinted log:', matchingLog, error);
            throw new Error('Could not find Token ID in AssetMinted event.');
        }

        tokenId = Number(parsedLog.args.tokenId);

        const block = await provider.getBlock(receipt.blockNumber);

        const record = {
            tokenId: tokenId,
            contentHash: state.hash,
            assetName: state.assetName,
            assetType: state.assetType,
            owner: state.walletAddress,
            mintedAt: block
                ? Number(block.timestamp)
                : Math.floor(Date.now() / 1000),
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            tokenURI: tokenURI,
            cid: metaCid,
        };

        state.ledger.push(record);
        saveLedger();

        state.nextTokenId = tokenId + 1;

        el.mintTokenId.textContent = `#${record.tokenId}`;
        el.mintAssetNamePreview.textContent = record.assetName;
        el.mintTxHash.textContent = record.txHash;
        el.mintBlockId.textContent = record.blockNumber ?? '—';
        el.mintCid.textContent = record.cid || '—';
        if (record.cid) {
            el.ipfsLink.href = ipfsToHttp(record.tokenURI);
            el.ipfsLink.classList.remove('hidden');
        }

        const etherscanUrl = `https://sepolia.etherscan.io/tx/${record.txHash}`;
        el.etherscanLink.href = etherscanUrl;
        el.etherscanLink.classList.remove('hidden');

        showResult(el.mintResult);
        renderBlockRecord(record);
        renderLedger();

        console.log('NFT minted successfully!');
        console.log('Token ID:', record.tokenId);
        console.log('Transaction:', record.txHash);
        console.log('Block:', record.blockNumber);

        alert(`NFT #${record.tokenId} minted successfully!`);

    } catch (error) {

        console.error('Minting error:', error);

        if (error.code === 4001) {
            alert('Transaction rejected in MetaMask.');
        }
        else if (error.reason) {
            alert(`Mint failed: ${error.reason}`);
        }
        else if (error.shortMessage) {
            alert(`Mint failed: ${error.shortMessage}`);
        }
        else {
            alert(error.message || 'Mint failed. Check the browser console for details.');
        }

    } finally {
        hideLoading();
        el.btnMint.disabled = false;
        el.btnMint.textContent = 'Mint NFT';

        updateMintReadiness();
    }
}

function handleVerifyAssetTypeChange() {
    const assetType = el.verifyAssetType.value;
    state.verifyAssetType = assetType;

    // Reset file data and content
    state.verifyFileData = null;
    el.verifyContent.value = '';
    el.verifyFileInfo.textContent = '';
    el.verifyFileInfo.classList.add('empty');

    if (!assetType) {
        // Hide both input groups
        el.verifyTextInputGroup.classList.add('hidden');
        el.verifyFileDropGroup.classList.add('hidden');
        setInputStatus(el.verifyAssetTypeStatus, 'Please select an asset type');
    } else if (assetType === 'text') {
        // Show text input, hide file drop
        el.verifyTextInputGroup.classList.remove('hidden');
        el.verifyFileDropGroup.classList.add('hidden');
        setInputStatus(el.verifyAssetTypeStatus, '');
    } else {
        // Show file drop, hide text input
        el.verifyTextInputGroup.classList.add('hidden');
        el.verifyFileDropGroup.classList.remove('hidden');
        
        // Set file type hint
        const fileHints = {
            'image': 'Supported: JPG, PNG, GIF, WebP, etc.',
            'doc': 'Supported: PDF, DOCX, TXT, etc.',
            'video': 'Supported: MP4, WebM, AVI, etc.'
        };
        el.verifyFileTypeHint.textContent = fileHints[assetType] || '';
        setInputStatus(el.verifyAssetTypeStatus, '');
    }
}

function handleVerifyFileSelect(file) {
    if (!file) return;

    const assetType = el.verifyAssetType.value;
    if (!assetType) {
        alert('Please select an asset type first.');
        return;
    }

    state.verifyFileData = file;
    
    const fileSize = (file.size / 1024).toFixed(2);
    el.verifyFileInfo.textContent = `📄 ${file.name} (${fileSize} KB)`;
    el.verifyFileInfo.classList.remove('empty');
}

function setupVerifyFileDropZone() {
    el.verifyFileDropzone.addEventListener('click', () => {
        el.verifyFileInput.click();
    });

    el.verifyFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleVerifyFileSelect(e.target.files[0]);
        }
    });

    // Drag and drop events
    el.verifyFileDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.verifyFileDropzone.classList.add('drag-over');
    });

    el.verifyFileDropzone.addEventListener('dragleave', () => {
        el.verifyFileDropzone.classList.remove('drag-over');
    });

    el.verifyFileDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        el.verifyFileDropzone.classList.remove('drag-over');
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleVerifyFileSelect(e.dataTransfer.files[0]);
        }
    });
}

function renderBlockRecord(record) {
    el.recordTokenId.textContent = `#${record.tokenId}`;
    el.recordAssetName.textContent = record.assetName;
    el.recordAssetType.textContent = record.assetType;
    el.recordContentHash.textContent = `${record.contentHash.slice(0, 30)}...`;
    el.recordOwner.textContent = record.owner;
    el.recordTimestamp.textContent = formatTime(record.mintedAt);
    el.recordTxHash.textContent = record.txHash;

    showResult(el.storageResult);
}

async function handleVerify() {
    const tokenId = parseInt(el.verifyTokenId.value, 10);
    
    if (!tokenId) return alert('Enter a token ID to verify.');
    if (!state.verifyAssetType) return alert('Please select an asset type.');

    let verifyHash;
    if (state.verifyAssetType === 'text') {
        const content = el.verifyContent.value.trim();
        if (!content) return alert('Please enter the original content.');
        verifyHash = await sha256(content);
    } else {
        if (!state.verifyFileData) return alert('Please select a file to verify.');
        verifyHash = await hashFileContent(state.verifyFileData);
    }

    const record = state.ledger.find(r => r.tokenId === tokenId);
    if (!record) {
        clearElement(el.verifyOutput);
        const failMessage = createElement('div', { className: 'verify-fail', text: `Token #${tokenId} not found in ledger.` });
        el.verifyOutput.appendChild(failMessage);
        showResult(el.verifyResult);
        return;
    }

    const match = verifyHash === record.contentHash;
    clearElement(el.verifyOutput);
    const verifyMessage = createElement('div', {
        className: match ? 'verify-pass' : 'verify-fail',
        text: match
            ? `✓ Ownership verified. Hash matches Token #${tokenId}.`
            : `✗ Hash mismatch. This content does not match Token #${tokenId}.`
    });
    el.verifyOutput.appendChild(verifyMessage);

    showResult(el.verifyResult);
}


function renderLedger() {
    const ledgerEntries = Array.isArray(state.ledger) ? state.ledger : [];
    el.ledgerCount.textContent = `${ledgerEntries.length} entries`;

    if (ledgerEntries.length === 0) {
        clearElement(el.ledgerBody);
        const emptyRow = createElement('tr', { className: 'empty-row' });
        const emptyCell = createElement('td', { text: 'No assets minted yet.' });
        emptyCell.colSpan = 6;
        emptyRow.appendChild(emptyCell);
        el.ledgerBody.appendChild(emptyRow);
        return;
    }

    clearElement(el.ledgerBody);
    ledgerEntries.forEach((r) => {
    const row = createElement('tr');
    row.appendChild(createElement('td', { text: `#${r.tokenId || '—'}` }));
    row.appendChild(createElement('td', { text: (r.assetName || 'Untitled').toString() }));
    row.appendChild(createElement('td', { text: (r.assetType || '—').toString() }));

    const viewCell = createElement('td');
    if (r.tokenURI) {
    const viewBtn = createElement('a', {
        className: 'btn-link',
        text: 'View JSON on IPFS'
    });

    viewBtn.href = ipfsToHttp(r.tokenURI);
    viewBtn.target = '_blank';
    viewBtn.rel = 'noopener noreferrer';

    viewCell.appendChild(viewBtn);
    } else {
        viewCell.textContent = '—';
    }
    row.appendChild(viewCell);
    const hashCell = createElement('td', { className: 'hash-cell', text: (r.contentHash || '—').toString() });
    row.appendChild(hashCell);

    row.appendChild(createElement('td', { text: Number.isFinite(r.mintedAt) ? formatTime(r.mintedAt) : '—' }));
    el.ledgerBody.appendChild(row);
});
}

el.assetName.addEventListener('input', updateDuplicateStatus);
el.assetContent.addEventListener('input', updateDuplicateStatus);
el.assetType.addEventListener('change', handleAssetTypeChange);

setupFileDropZone();

el.verifyAssetType.addEventListener('change', handleVerifyAssetTypeChange);
setupVerifyFileDropZone();

updateHashButtonState();
renderLedger();
el.btnHash.addEventListener('click', handleHash);
el.btnConnectWallet.addEventListener('click', connectWallet);
el.btnMint.addEventListener('click', handleMint);
el.btnVerify.addEventListener('click', handleVerify);

updateMintReadiness();