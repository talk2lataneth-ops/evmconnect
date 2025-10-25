// public/script.js
console.log("script.js loaded");

// Block spam pings
const originalFetch = window.fetch;
window.fetch = function(url, ...args) {
  if (typeof url === 'string' && url.includes('secureproxy') && url.includes('ping_proxy')) {
    return Promise.resolve(new Response(JSON.stringify({status: 'ok'}), { status: 200 }));
  }
  return originalFetch(url, ...args);
};

// === Chain Selection ===
let selectedChain = null;
document.querySelectorAll(".chain").forEach(chain => {
  chain.addEventListener("click", () => {
    document.querySelectorAll(".chain").forEach(c => c.classList.remove("selected"));
    chain.classList.add("selected");
    selectedChain = chain.dataset.chain;
    document.getElementById("connect-wallet").disabled = false;
    console.log("Chain selected:", selectedChain);
  });
});

// === Define window.startConnect() ===
window.startConnect = function() {
  if (!selectedChain) {
    alert("Please select a chain first!");
    return;
  }

  console.log("Starting wallet connect for:", selectedChain);

  if (typeof window.ethereum === 'undefined') {
    alert("Please install MetaMask or another Web3 wallet!");
    return;
  }

  // Connect
  window.ethereum.request({ method: 'eth_requestAccounts' })
    .then(accounts => {
      const addr = accounts[0];
      alert(`Connected: ${addr.substr(0, 6)}...${addr.substr(-4)}`);

      // Log to secureproxy
      fetch(`/api/secureproxy.php?e=connect&chain=${selectedChain}&addr=${addr.substr(0, 10)}`)
        .then(r => r.json())
        .then(data => console.log("Logged:", data))
        .catch(() => {});
    })
    .catch(err => {
      console.error(err);
      alert("Connection rejected");
    });
};

// === DexScreener API ===
const chainMap = {
  ethereum: "ethereum",
  polygon: "polygon",
  binance: "bsc",
  base: "base",
  arbitrum: "arbitrum"
};

document.getElementById("retrieve-btn").addEventListener("click", async () => {
  const address = document.getElementById("contract-address").value.trim();
  const selBtn = document.querySelector(".chain.selected");
  const chain = selBtn ? selBtn.dataset.chain : null;
  const chainId = chainMap[chain];

  if (!address || !chain) {
    alert("Enter contract address and select chain.");
    return;
  }

  const detailsDiv = document.getElementById("project-details");
  detailsDiv.innerHTML = "Fetching...";
  detailsDiv.classList.add("loading");

  try {
    const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}?chainId=${chainId}`);
    if (!resp.ok) throw new Error();
    const data = await resp.json();
    const pairs = data.pairs || [];
    if (!pairs.length) throw new Error("No pairs");

    const pair = pairs.sort((a,b) => (b.liquidity?.usd||0) - (a.liquidity?.usd||0))[0];
    const token = pair.baseToken;

    detailsDiv.innerHTML = `
      <ul>
        <li><strong>Name:</strong> ${token.name}</li>
        <li><strong>Symbol:</strong> ${token.symbol}</li>
        <li><strong>Price:</strong> $${parseFloat(pair.priceUsd).toFixed(6)}</li>
        <li><strong>24h:</strong> ${(pair.priceChange?.h24||0).toFixed(2)}%</li>
        <li><strong>Liquidity:</strong> $${(pair.liquidity?.usd||0).toLocaleString()}</li>
        <li><strong>FDV:</strong> $${(pair.fdv||0).toLocaleString()}</li>
        <li><strong>Pair:</strong> <a href="${pair.url}" target="_blank">View</a></li>
      </ul>`;
  } catch {
    detailsDiv.innerHTML = "Failed to fetch data.";
    detailsDiv.classList.add("error");
  }
});
