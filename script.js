


function normalizeLedger(rawLedger) {
    if (!Array.isArray(rawLedger)) return [];

    return rawLedger
        .filter(Boolean)
        .map((entry, index) => ({
            tokenId: Number.isFinite(entry?.tokenId) ? entry.tokenId : index + 1,
            contentHash: entry?.contentHash || '',
            assetName: entry?.assetName || `Asset ${index + 1}`,
            owner: entry?.owner || '—',
            mintedAt: Number.isFinite(entry?.mintedAt) ? entry.mintedAt : Math.floor(Date.now() / 1000),
            txHash: entry?.txHash || '',
            blockNumber: Number.isFinite(entry?.blockNumber) ? entry.blockNumber : null
        }));
}

let provider;
let signer;
let contract;


const savedLedger = normalizeLedger(loadLedger());
const state = {
    hash: null,
    assetName: '',
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
    assetContent: $('assetContent'),
    assetNameStatus: $('assetNameStatus'),
    assetContentStatus: $('assetContentStatus'),
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
    mintWalletAddr: $('mintWalletAddr'),
    walletStatus: $('walletStatus'),
    walletCard: $('walletCard'),
    mintResult: $('mintResult'),
    nftCardPreview: $('nftCardPreview'),
    mintDetails: $('mintDetails'),

    blockchainRecord: $('blockchainRecord'),
    recordTokenId: $('recordTokenId'),
    recordContentHash: $('recordContentHash'),
    recordOwner: $('recordOwner'),
    recordTimestamp: $('recordTimestamp'),
    storageResult: $('storageResult'),
    blockVisual: $('blockVisual'),
    recordTxHash: $('recordTxHash'),

    verifyTokenId: $('verifyTokenId'),
    verifyHash: $('verifyHash'),
    btnVerify: $('btnVerify'),
    verifyResult: $('verifyResult'),
    verifyLabel: $('verifyLabel'),
    verifyOutput: $('verifyOutput'),

    ledgerCount: $('ledgerCount'),
    ledgerBody: $('ledgerBody')
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
    return new Date(ts * 1000).toLocaleString();
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
    const content = (el.assetContent.value || '').trim();
    const ledgerEntries = Array.isArray(state.ledger) ? state.ledger : [];

    state.duplicateName = Boolean(name && ledgerEntries.some(item => (item?.assetName || '').toString().toLowerCase() === name.toLowerCase()));
    setInputStatus(el.assetNameStatus, state.duplicateName ? 'This asset name already exists.' : '');

    if (!content) {
        state.duplicateContent = false;
        setInputStatus(el.assetContentStatus, '');
        updateHashButtonState();
        return;
    }

    sha256(content).then((hash) => {
        state.duplicateContent = ledgerEntries.some(item => (item?.contentHash || '').toString() === hash);
        setInputStatus(el.assetContentStatus, state.duplicateContent ? 'This content already exists.' : '');
        updateHashButtonState();
    }).catch(() => {
        state.duplicateContent = false;
        setInputStatus(el.assetContentStatus, '');
        updateHashButtonState();
    });
}

function updateHashButtonState() {
    const hasInput = Boolean((el.assetName.value || '').trim() && (el.assetContent.value || '').trim());
    const isBlocked = state.duplicateName || state.duplicateContent;
    el.btnHash.disabled = !hasInput || isBlocked;
    if (isBlocked) {
        el.btnHash.textContent = 'Duplicate asset';
    } else {
        el.btnHash.textContent = 'Generate SHA-256 Hash';
    }
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
    const content = el.assetContent.value.trim();

    if (!name) return alert('Please enter an asset name.');
    if (!content) return alert('Please enter content.');
    if (state.duplicateName || state.duplicateContent) {
        alert('This asset name or content already exists in the ledger.');
        return;
    }

    const hash = await sha256(content);

    state.hash = hash;
    state.assetName = name;

    el.hashDisplay.textContent = hash;
    el.hashMeta.textContent = '';

    showResult(el.hashResult);
    updateMintReadiness();
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

        const tx = await contract.mintNFT(
            state.assetName,
            state.hash
        );

        console.log('Transaction submitted:', tx.hash);

        el.btnMint.textContent = 'Minting...';

        const receipt = await tx.wait();

        console.log('Transaction confirmed:', receipt);


        let tokenId = null;

        for (const log of receipt.logs) {
            try {
                const parsedLog = contract.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });

                if (parsedLog && parsedLog.name === 'AssetMinted') {
                    tokenId = Number(parsedLog.args.tokenId);
                    break;
                }
            } catch (error) {
                console.warn('Failed to parse log:', error);
            }
        }

        if (tokenId === null) {
            throw new Error('Could not find Token ID in AssetMinted event.');
        }

        const block = await provider.getBlock(receipt.blockNumber);

        const record = {
            tokenId: tokenId,
            contentHash: state.hash,
            assetName: state.assetName,
            owner: state.walletAddress,
            mintedAt: block
                ? Number(block.timestamp)
                : Math.floor(Date.now() / 1000),
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber
        };

        state.ledger.push(record);
        saveLedger();

        state.nextTokenId = tokenId + 1;

        el.mintTokenId.textContent = `#${record.tokenId}`;
        el.mintAssetNamePreview.textContent = record.assetName;
        el.mintTxHash.textContent = record.txHash;

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

        // User rejected MetaMask transaction
        if (error.code === 4001) {
            alert('Transaction rejected in MetaMask.');
        }

        // Solidity require() failure
        else if (error.reason) {
            alert(`Mint failed: ${error.reason}`);
        }

        else if (error.shortMessage) {
            alert(`Mint failed: ${error.shortMessage}`);
        }

        else {
            alert('Mint failed. Check the browser console for details.');
        }

    } finally {
        hideLoading();
        el.btnMint.disabled = false;
        el.btnMint.textContent = 'Mint NFT';

        updateMintReadiness();
    }
}

function renderBlockRecord(record) {
    el.recordTokenId.textContent = `#${record.tokenId}`;
    el.recordContentHash.textContent = `${record.contentHash.slice(0, 30)}...`;
    el.recordOwner.textContent = record.owner;
    el.recordTimestamp.textContent = formatTime(record.mintedAt);
    el.recordTxHash.textContent = record.txHash;

    showResult(el.storageResult);
}

async function handleVerify() {
    const tokenId = parseInt(el.verifyTokenId.value, 10);
    const content = el.verifyHash.value.trim();

    if (!tokenId || !content) return alert('Enter a token ID and content to verify.');

    const record = state.ledger.find(r => r.tokenId === tokenId);
    if (!record) {
        clearElement(el.verifyOutput);
        const failMessage = createElement('div', { className: 'verify-fail', text: `Token #${tokenId} not found in ledger.` });
        el.verifyOutput.appendChild(failMessage);
        showResult(el.verifyResult);
        return;
    }

    const newHash = await sha256(content);

    const match = newHash === record.contentHash;
    clearElement(el.verifyOutput);
    const verifyMessage = createElement('div', {
        className: match ? 'verify-pass' : 'verify-fail',
        text: match
            ? `Ownership verified. Hash matches Token #${tokenId}.`
            : `Hash mismatch. This content does not match Token #${tokenId}.`
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
        emptyCell.colSpan = 4;
        emptyRow.appendChild(emptyCell);
        el.ledgerBody.appendChild(emptyRow);
        return;
    }

    clearElement(el.ledgerBody);
    ledgerEntries.forEach((r) => {
        const row = createElement('tr');
        row.appendChild(createElement('td', { text: `#${r.tokenId || '—'}` }));
        row.appendChild(createElement('td', { text: (r.assetName || 'Untitled').toString() }));
        const hashCell = createElement('td', { className: 'hash-cell', text: (r.contentHash || '—').toString() });
        row.appendChild(hashCell);
        row.appendChild(createElement('td', { text: Number.isFinite(r.mintedAt) ? formatTime(r.mintedAt) : '—' }));
        el.ledgerBody.appendChild(row);
    });
}

el.assetName.addEventListener('input', updateDuplicateStatus);
el.assetContent.addEventListener('input', updateDuplicateStatus);

updateHashButtonState();
renderLedger();
el.btnHash.addEventListener('click', handleHash);
el.btnConnectWallet.addEventListener('click', connectWallet);
el.btnMint.addEventListener('click', handleMint);
el.btnVerify.addEventListener('click', handleVerify);

updateMintReadiness();