// script.js - All app logic
document.addEventListener("DOMContentLoaded", function () {
  console.log("script.js loaded");

  const chains = document.querySelectorAll(".chain");
  const connectBtn = document.getElementById("connect-wallet");
  const retrieveBtn = document.getElementById("retrieve-btn");
  const contractInput = document.getElementById("contract-address");
  const projectDetails = document.getElementById("project-details");

  let selectedChain = null;

  // Chain selection
  chains.forEach(chain => {
    chain.addEventListener("click", () => {
      chains.forEach(c => c.classList.remove("selected"));
      chain.classList.add("selected");
      selectedChain = chain.dataset.chain;
      connectBtn.disabled = false;
      connectBtn.style.opacity = "1";
      console.log("Chain selected:", selectedChain);
    });
  });

  // Connect Wallet - requires chain
  connectBtn.addEventListener("click", () => {
    if (!selectedChain) {
      alert("Please select a chain before connecting.");
      return;
    }

    if (typeof window.connectWallet === "function") {
      window.connectWallet(selectedChain);
    } else {
      console.error("connectWallet() not defined – check script22.js");
    }
  });

  // DexScreener API mapping
  const chainMap = {
    ethereum: "ethereum",
    polygon: "polygon",
    binance: "bsc",
    base: "base",
    arbitrum: "arbitrum"
  };

  // Retrieve project details
  retrieveBtn.addEventListener("click", async () => {
    const address = contractInput.value.trim();
    const selBtn = document.querySelector(".chain.selected");
    const chain = selBtn ? selBtn.dataset.chain : null;
    const chainId = chainMap[chain];

    if (!address || !chain) {
      alert("Enter a contract address and select a chain.");
      return;
    }

    projectDetails.innerHTML = "";
    projectDetails.classList.add("loading");
    projectDetails.textContent = "Fetching from DexScreener…";

    try {
      const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}?chainId=${chainId}`);
      if (!resp.ok) throw new Error("API error");
      const data = await resp.json();
      const pairs = data.pairs || [];

      if (!pairs.length) {
        projectDetails.classList.add("error");
        projectDetails.textContent = "No trading pairs found.";
        return;
      }

      const pair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const token = pair.baseToken;

      projectDetails.innerHTML = `
        <ul>
          <li><strong>Name:</strong> ${token.name}</li>
          <li><strong>Symbol:</strong> ${token.symbol}</li>
          <li><strong>Price USD:</strong> $${parseFloat(pair.priceUsd).toFixed(6)}</li>
          <li><strong>24h Change:</strong> ${(pair.priceChange?.h24 || 0).toFixed(2)}%</li>
          <li><strong>Liquidity:</strong> $${(pair.liquidity?.usd || 0).toLocaleString()}</li>
          <li><strong>Volume 24h:</strong> $${(pair.volume?.h24 || 0).toLocaleString()}</li>
          <li><strong>FDV:</strong> $${(pair.fdv || 0).toLocaleString()}</li>
          <li><strong>Pair:</strong> <a href="${pair.url}" target="_blank" style="color:var(--primary);text-decoration:underline;">View on DexScreener</a></li>
        </ul>`;
    } catch (e) {
      projectDetails.classList.add("error");
      projectDetails.textContent = "Failed to fetch data.";
      console.error(e);
    }
  });
});