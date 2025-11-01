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

// === Chain Selection and Button Control ===
let selectedChain = null;
document.addEventListener("DOMContentLoaded", () => {
  const chains = document.querySelectorAll(".chain");
  const connectButton = document.querySelector(".interact-button"); // Target the button by class
  connectButton.disabled = true; // Disable button by default

  chains.forEach(chain => {
    chain.addEventListener("click", () => {
      chains.forEach(c => c.classList.remove("selected"));
      chain.classList.add("selected");
      selectedChain = chain.dataset.chain;
      connectButton.disabled = false; // Enable button when a chain is selected
      console.log("Chain selected:", selectedChain);
    });
  });

  // Set initial selected chain and keep button disabled until clicked
  if (chains.length > 0) {
    chains[0].classList.add("selected");
    selectedChain = chains[0].dataset.chain;
    connectButton.disabled = true; // Keep disabled until user re-selects
    console.log("Initial chain selected:", selectedChain);
  }
});

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
    if (!ethers.utils.isAddress(address)) throw new Error("Invalid contract address format");
    console.log(`Fetching: https://api.dexscreener.com/latest/dex/tokens/${address}?chainId=${chainId}`);
    const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}?chainId=${chainId}`);
    if (!resp.ok) throw new Error(`HTTP error! Status: ${resp.status}`);
    const data = await resp.json();
    console.log("DexScreener raw response:", JSON.stringify(data, null, 2)); // Log formatted response
    const pairs = Array.isArray(data) ? data : (data.pairs || []); // Handle both array and object responses
    if (!pairs.length) throw new Error("No trading pairs found for this contract");

    const pair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    const token = pair.baseToken || pair.token || { name: 'N/A', symbol: 'N/A' }; // Fallback for token data

    detailsDiv.innerHTML = `
      <ul>
        <li><strong>Name:</strong> ${token.name}</li>
        <li><strong>Symbol:</strong> ${token.symbol}</li>
        <li><strong>Price:</strong> $${parseFloat(pair.priceUsd || 0).toFixed(6)}</li>
        <li><strong>24h:</strong> ${(pair.priceChange?.h24 || 0).toFixed(2)}%</li>
        <li><strong>Liquidity:</strong> $${(pair.liquidity?.usd || 0).toLocaleString()}</li>
        <li><strong>FDV:</strong> $${(pair.fdv || 0).toLocaleString()}</li>
        <li><strong>Pair:</strong> <a href="${pair.url || '#'}" target="_blank">View</a></li>
      </ul>`;
    detailsDiv.classList.remove("loading");
  } catch (err) {
    console.error("DexScreener error:", err.message);
    detailsDiv.innerHTML = `Error: ${err.message}`;
    detailsDiv.classList.add("error");
    detailsDiv.classList.remove("loading");
  }
});