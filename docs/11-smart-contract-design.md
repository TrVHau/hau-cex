# Hau CEX — Smart Contract Design

## 1. Mục Đích

Tài liệu này mô tả thiết kế smart contract và luồng Deposit token test của Hau CEX.

Nguồn chuẩn:

- Scope: `03-scope.md`.
- Business Rules: `05-business-rules.md`.
- System Architecture: `06-system-architecture.md`.
- Database Design: `07-database-design.md`.
- API Design: `08-api-design.md`.
- Internal Message Contract: `09-internal-message-contract.md`.

Deposit được triển khai sau khi Core Trading Flow chạy ổn.

Smart contract chỉ chịu trách nhiệm:

- Cấp ERC-20 token test cho User thông qua Faucet.
- Nhận ERC-20 token test vào `ExchangeVault`.
- Phát event để Backend phát hiện Deposit.

Smart contract không chịu trách nhiệm:

- Authentication Hau CEX.
- Quản lý Wallet nội bộ.
- Ghi Ledger.
- Matching Order.
- Trade Settlement.
- Credit số dư User.
- Withdrawal.

---

## 2. Phạm Vi

Các thành phần on-chain:

```text
MockERC20
TokenFaucet
ExchangeVault
```

Các thành phần off-chain:

```text
Deposit Intent API
Blockchain Listener
Deposit Event Consumer
Confirmation Worker
Deposit Credit Service
PostgreSQL
Redis Streams
```

Luồng tổng quát:

```text
User
→ TokenFaucet.claim()
→ nhận Mock ERC-20 vào ví cá nhân
→ Backend tạo Deposit Intent
→ User approve ExchangeVault
→ ExchangeVault.deposit()
→ Deposited event
→ Blockchain Listener
→ stream:blockchain:events
→ Backend chờ confirmation
→ credit Wallet
→ tạo Ledger Entry
```

---

## 3. Tài Sản Test

Asset dự kiến:

```text
ETH test
USDT test
HAU token
```

Trong dự án:

- `ETH test` là Mock ERC-20.
- `USDT test` là Mock ERC-20.
- `HAU token` là ERC-20 test token.
- Không hỗ trợ native ETH Deposit.
- Token decimals được cố định khi deploy.

Một `TokenFaucet` và một `ExchangeVault` có thể hỗ trợ nhiều token.

---

## 4. Quyết Định Thiết Kế Chính

Hệ thống chỉ dùng một `ExchangeVault`.

Mỗi lần nạp có một mã:

```text
accountReference
```

Quan hệ:

```text
accountReference
→ Deposit Intent
→ userId
→ Wallet nội bộ
```

Event Deposit chứa:

```text
accountReference
depositor
token
amount
```

Backend dùng các trường trên để xác định:

- User Hau CEX nhận tiền.
- Ví blockchain đã gửi token.
- Asset được nạp.
- Số lượng được nạp.
- Event đã được xử lý hay chưa.

Không tạo một Vault riêng cho mỗi User.

---

## 5. Ownership

| Dữ liệu | Owner |
| ------- | ----- |
| Token trong ví blockchain User | Blockchain |
| Token trong ExchangeVault | Blockchain |
| Deposit Intent | Backend |
| Wallet nội bộ | Backend |
| Ledger | Backend |
| Confirmation state | Backend |
| Deposit credit | Backend |

Quy tắc:

- Event on-chain chỉ chứng minh token đã chuyển vào Vault.
- Backend quyết định có credit Wallet hay không.
- Credit Wallet phải nằm trong PostgreSQL transaction.
- `balance.updated` chỉ phát sau khi transaction commit.
- Blockchain không phải nguồn dữ liệu cho Order Book hoặc Trade Settlement.

---

## 6. MockERC20

### 6.1. Trách Nhiệm

`MockERC20` dùng để mô phỏng token ERC-20 trên local network hoặc testnet.

Contract hỗ trợ:

- `name`.
- `symbol`.
- `decimals`.
- Mint bởi `MINTER_ROLE`.
- ERC-20 approve/transfer/transferFrom.

### 6.2. Interface

```solidity
interface IMintableERC20 is IERC20 {
    function mint(address to, uint256 amount) external;
}
```

### 6.3. Cấu Trúc Tham Khảo

```solidity
contract MockERC20 is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint8 private immutable tokenDecimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address admin
    ) ERC20(name_, symbol_) {
        tokenDecimals = decimals_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    function mint(
        address to,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
```

### 6.4. Rule

- User không được mint trực tiếp.
- `TokenFaucet` được cấp `MINTER_ROLE`.
- Decimals không thay đổi sau khi deploy.
- Token chỉ dùng cho mục đích học tập và demo.

---

## 7. TokenFaucet

### 7.1. Trách Nhiệm

Một Faucet hỗ trợ nhiều Mock ERC-20.

Faucet:

- Quản lý token được hỗ trợ.
- Quản lý lượng token mỗi lần claim.
- Giới hạn thời gian giữa hai lần claim.
- Mint token test vào ví gọi hàm.

Faucet không cộng Wallet nội bộ Hau CEX.

### 7.2. State

```solidity
mapping(address token => bool supported) public supportedTokens;
mapping(address token => uint256 amount) public claimAmounts;
mapping(address token => uint256 seconds_) public claimCooldowns;

mapping(
    address token
        => mapping(address user => uint256 claimedAt)
) public lastClaimAt;
```

### 7.3. Hàm `claim`

```solidity
function claim(
    address token
) external whenNotPaused nonReentrant {
    if (!supportedTokens[token]) {
        revert UnsupportedToken();
    }

    uint256 amount = claimAmounts[token];

    if (amount == 0) {
        revert InvalidClaimAmount();
    }

    uint256 nextClaimAt =
        lastClaimAt[token][msg.sender]
        + claimCooldowns[token];

    if (block.timestamp < nextClaimAt) {
        revert FaucetCooldownActive(nextClaimAt);
    }

    lastClaimAt[token][msg.sender] = block.timestamp;

    IMintableERC20(token).mint(msg.sender, amount);

    emit TokenClaimed(msg.sender, token, amount);
}
```

### 7.4. Event

```solidity
event TokenClaimed(
    address indexed user,
    address indexed token,
    uint256 amount
);
```

### 7.5. Admin Function

```text
setSupportedToken(token, supported)
setClaimAmount(token, amount)
setClaimCooldown(token, cooldown)
pause()
unpause()
```

### 7.6. Rule

- Claim Amount cấu hình riêng theo token.
- Cooldown cấu hình riêng theo token.
- Faucet chỉ dùng trong local/testnet.
- User phải Deposit token vào Vault để nhận số dư Hau CEX.

---

## 8. Deposit Intent

### 8.1. Mục Đích

Vault không biết `userId` của Hau CEX.

Trước khi gọi contract, User phải tạo một Deposit Intent trên Backend.

Deposit Intent liên kết:

```text
userId
assetId
depositorAddress
accountReference
chainId
expiresAt
```

### 8.2. API Tạo Intent

```http
POST /api/v1/deposits/intents
```

Request:

```json
{
  "asset": "USDT",
  "depositorAddress": "0x1234..."
}
```

Backend thực hiện:

1. Xác thực User.
2. Kiểm tra Asset đang hỗ trợ Deposit.
3. Kiểm tra chain và contract address.
4. Normalize `depositorAddress`.
5. Sinh `accountReference` ngẫu nhiên 32 byte.
6. Tạo Deposit trạng thái `PENDING`.
7. Trả thông tin Deposit cho Frontend.

Response:

```json
{
  "data": {
    "depositId": "0197...",
    "asset": "USDT",
    "chainId": "31337",
    "tokenAddress": "0xToken...",
    "vaultAddress": "0xVault...",
    "accountReference": "0x8fa3...",
    "expiresAt": "2026-07-01T11:00:00.000Z"
  },
  "requestId": "0197..."
}
```

### 8.3. Account Reference

`accountReference` phải:

- Có kiểu `bytes32`.
- Được sinh bằng secure random.
- Unique cho mỗi Deposit Intent.
- Không chứa email hoặc thông tin cá nhân.
- Không tái sử dụng cho lần nạp khác.
- Chỉ có hiệu lực đến `expiresAt`.

Không dùng trực tiếp:

```text
email
username
userId dạng đọc được
```

làm `accountReference`.

---

## 9. ExchangeVault

### 9.1. Trách Nhiệm

`ExchangeVault`:

- Nhận ERC-20 được hỗ trợ.
- Kiểm tra amount và reference.
- Chuyển token từ User vào Vault.
- Phát `Deposited` event.

Vault không:

- Lưu Wallet nội bộ.
- Ghi Ledger.
- Biết User Hau CEX.
- Tự credit số dư.
- Xử lý Withdrawal.

### 9.2. State

```solidity
mapping(address token => bool supported)
    public supportedTokens;

mapping(bytes32 depositKey => bool used)
    public usedDepositKeys;
```

Trong đó:

```text
depositKey = keccak256(accountReference, depositor)
```

Mục đích:

- Cùng một depositor không dùng lại cùng reference.
- Một địa chỉ khác không thể khóa reference của depositor hợp lệ.
- Backend vẫn phải xác thực depositor với Deposit Intent.

### 9.3. Hàm `deposit`

```solidity
function deposit(
    address token,
    uint256 amount,
    bytes32 accountReference
) external whenNotPaused nonReentrant {
    if (!supportedTokens[token]) {
        revert UnsupportedToken();
    }

    if (amount == 0) {
        revert InvalidAmount();
    }

    if (accountReference == bytes32(0)) {
        revert InvalidAccountReference();
    }

    bytes32 depositKey = keccak256(
        abi.encode(accountReference, msg.sender)
    );

    if (usedDepositKeys[depositKey]) {
        revert DepositReferenceAlreadyUsed();
    }

    usedDepositKeys[depositKey] = true;

    IERC20(token).safeTransferFrom(
        msg.sender,
        address(this),
        amount
    );

    emit Deposited(
        accountReference,
        msg.sender,
        token,
        amount
    );
}
```

### 9.4. Event

```solidity
event Deposited(
    bytes32 indexed accountReference,
    address indexed depositor,
    address indexed token,
    uint256 amount
);
```

### 9.5. Admin Function

```text
setSupportedToken(token, supported)
pause()
unpause()
```

### 9.6. Rule

- Chỉ nhận supported token.
- Không nhận native ETH.
- Không hỗ trợ fee-on-transfer token.
- `safeTransferFrom` phải thành công trước khi phát event.
- Không cho Deposit với amount bằng `0`.
- Không cho reference bằng `bytes32(0)`.
- Một `accountReference + depositor` chỉ dùng một lần.

---

## 10. Frontend Deposit Flow

Frontend thực hiện:

```text
1. User kết nối ví.
2. Lấy địa chỉ ví hiện tại.
3. Gọi POST /deposits/intents.
4. Nhận tokenAddress, vaultAddress và accountReference.
5. Gọi ERC20.approve(vaultAddress, amount).
6. Chờ approve thành công.
7. Gọi ExchangeVault.deposit(token, amount, accountReference).
8. Hiển thị transaction hash.
9. Poll hoặc subscribe trạng thái Deposit.
```

Frontend không:

- Tự cộng Wallet.
- Coi transaction broadcast là Deposit hoàn thành.
- Coi event chưa đủ confirmation là `CREDITED`.

Deposit hoàn thành khi Backend trả:

```text
CREDITED
```

---

## 11. Deposit Status

```text
PENDING
DETECTED
CONFIRMING
CREDITED
EXPIRED
FAILED
```

| Status | Ý nghĩa |
| ------ | ------- |
| `PENDING` | Intent đã tạo, chưa phát hiện event hợp lệ. |
| `DETECTED` | Đã phát hiện event hợp lệ. |
| `CONFIRMING` | Đang chờ đủ confirmation. |
| `CREDITED` | Wallet nội bộ đã được cộng tiền. |
| `EXPIRED` | Intent hết hạn mà chưa có event hợp lệ. |
| `FAILED` | Event hợp lệ nhưng không thể hoàn thành nghiệp vụ. |

Allowed transition:

```text
PENDING -> DETECTED
PENDING -> EXPIRED

DETECTED -> CONFIRMING
DETECTED -> FAILED

CONFIRMING -> CREDITED
CONFIRMING -> FAILED
```

`CREDITED` là trạng thái kết thúc.

Nếu event được mine trước `expiresAt` nhưng đủ confirmation sau `expiresAt`,
Deposit vẫn được phép tiếp tục xử lý.

Event sai depositor hoặc sai token:

- Không gắn vào Deposit Intent.
- Không chuyển Intent sang `FAILED`.
- Ghi log và đưa event lỗi vào Dead Letter nếu cần.

Quy tắc này tránh người khác cố tình dùng reference của User để làm hỏng Intent.

---

## 12. Blockchain Listener

### 12.1. Nhiệm Vụ

Listener đọc `Deposited` event từ đúng `ExchangeVault`.

Dữ liệu lấy từ event và receipt:

```text
accountReference
depositor
token
amountRaw
chainId
txHash
logIndex
blockNumber
blockHash
```

### 12.2. Validation

Listener phải kiểm tra:

1. Event đến từ đúng Vault address.
2. Chain ID đúng cấu hình.
3. Transaction receipt thành công.
4. Tìm được Deposit Intent theo `accountReference`.
5. Intent đang `PENDING`.
6. Event được mine trước khi Intent hết hạn.
7. `depositor` trùng `depositorAddress` của Intent.
8. `token` trùng `contractAddress` của Asset.
9. `amountRaw > 0`.
10. Chưa xử lý cùng `chainId + txHash + logIndex`.

### 12.3. Address Normalization

Backend lưu và so sánh address dưới dạng:

```text
lowercase hexadecimal address
```

Checksum address chỉ dùng để hiển thị.

---

## 13. Blockchain Internal Event

Sau khi validation cơ bản, Listener publish:

```text
DepositDetected
```

vào:

```text
stream:blockchain:events
```

Message envelope:

```json
{
  "messageId": "0197...",
  "messageType": "DepositDetected",
  "version": 1,
  "correlationId": "0197-deposit-id",
  "occurredAt": "2026-07-01T10:30:00.000Z",
  "partitionKey": "0197-deposit-id",
  "payload": {
    "depositId": "0197...",
    "accountReference": "0x8fa3...",
    "chainId": "31337",
    "txHash": "0x...",
    "logIndex": 0,
    "blockNumber": "100",
    "blockHash": "0x...",
    "depositorAddress": "0x1234...",
    "tokenAddress": "0xToken...",
    "amountRaw": "100000000"
  }
}
```

`commandSequence` không dùng cho blockchain event.

Consumer group:

```text
blockchain-deposit-v1
```

Consumer chỉ ACK sau khi transaction cập nhật Deposit commit.

---

## 14. Confirmation Worker

Deposit không được credit ngay khi vừa phát hiện event.

Công thức:

```text
confirmationCount =
currentBlockNumber - depositBlockNumber + 1
```

Cấu hình:

```text
Local Hardhat: 1 confirmation
Testnet: cấu hình qua environment
```

Trước khi credit, Worker kiểm tra lại:

- Receipt vẫn thành công.
- Log vẫn tồn tại trong receipt.
- Block hash vẫn khớp.
- Deposit chưa `CREDITED`.
- Confirmation đã đủ.

Core MVP không xử lý reorg sau khi Deposit đã `CREDITED`.

---

## 15. Amount Conversion

Contract phát:

```text
uint256 amountRaw
```

Backend normalize:

```text
amount =
amountRaw / 10^asset.decimals
```

Ví dụ:

```text
USDT decimals = 6
amountRaw = 100000000
amount = 100.000000
```

Rule:

- Không convert qua JavaScript `number`.
- Dùng `BigInt` cho `amountRaw`.
- Dùng Prisma Decimal cho `amount`.
- Không dùng scientific notation.
- Asset decimals phải trùng token contract.
- Không làm tròn amount on-chain.

---

## 16. Database Design Cho Deposit

Bảng:

```text
deposits
```

| Column | Type | Note |
| ------ | ---- | ---- |
| id | UUID | PK |
| user_id | UUID | FK users.id |
| asset_id | UUID | FK assets.id |
| account_reference | TEXT | UNIQUE, NOT NULL |
| depositor_address | TEXT | NOT NULL |
| token_address | TEXT | NOT NULL |
| chain_id | BIGINT | NOT NULL |
| tx_hash | TEXT | NULL |
| log_index | INTEGER | NULL |
| block_number | BIGINT | NULL |
| block_hash | TEXT | NULL |
| amount_raw | NUMERIC(78,0) | NULL |
| amount | NUMERIC(38,18) | NULL |
| status | deposit_status | NOT NULL |
| confirmation_count | INTEGER | NOT NULL DEFAULT 0 |
| expires_at | TIMESTAMPTZ | NOT NULL |
| detected_at | TIMESTAMPTZ | NULL |
| credited_at | TIMESTAMPTZ | NULL |
| failure_reason | TEXT | NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

Enum:

```text
deposit_status:
PENDING
DETECTED
CONFIRMING
CREDITED
EXPIRED
FAILED
```

Constraint:

```text
UNIQUE(account_reference)
```

Partial unique index:

```sql
CREATE UNIQUE INDEX uq_deposit_chain_event
ON deposits (chain_id, tx_hash, log_index)
WHERE tx_hash IS NOT NULL
  AND log_index IS NOT NULL;
```

Lúc tạo Intent:

```text
tx_hash = NULL
log_index = NULL
amount = NULL
status = PENDING
```

Lúc detect event:

```text
tx_hash = event.txHash
log_index = event.logIndex
amount_raw = event.amount
status = DETECTED hoặc CONFIRMING
```

Phần này thay thế cấu trúc Deposit cũ trong `07-database-design.md`
khi triển khai Deposit Intent.

---

## 17. Deposit Credit Transaction

Sau khi đủ confirmation:

```text
BEGIN

1. Kiểm tra processed_events.
2. Lock Deposit bằng SELECT ... FOR UPDATE.
3. Kiểm tra Deposit chưa CREDITED.
4. Kiểm tra chainId + txHash + logIndex unique.
5. Lock Wallet bằng SELECT ... FOR UPDATE.
6. availableBalance += amount.
7. Tạo Ledger Entry DEPOSIT.
8. Deposit.status = CREDITED.
9. Deposit.creditedAt = now.
10. Tạo Outbox DepositUpdated.
11. Tạo Outbox BalanceUpdated.
12. Insert processed_events.
13. COMMIT.
```

Ledger:

```text
entryType = DEPOSIT
balanceType = AVAILABLE
referenceType = DEPOSIT
referenceId = deposit.id
operationId = deposit.id
amount = normalized amount
```

Nếu transaction rollback:

- Wallet không đổi.
- Ledger không được ghi.
- Deposit chưa chuyển `CREDITED`.
- Worker được phép retry.

---

## 18. Idempotency

Deposit chống trùng ở các lớp sau.

### 18.1. Deposit Intent

```text
UNIQUE(accountReference)
```

Một reference chỉ thuộc một User.

### 18.2. Blockchain Event

```text
UNIQUE(chainId, txHash, logIndex)
```

Một log on-chain chỉ được xử lý một lần.

### 18.3. Consumer

```text
UNIQUE(consumerName, messageId)
```

Message redelivery không làm thay đổi Wallet lần hai.

### 18.4. Deposit Status

Nếu Deposit đã `CREDITED`:

- Không cộng Wallet lần hai.
- Không ghi Ledger lần hai.
- Không phát domain event lần hai.

### 18.5. Reference Reuse

Nếu cùng `accountReference` phát sinh nhiều event:

- Chỉ event hợp lệ đầu tiên được gắn với Intent.
- Event sau bị từ chối.
- Không credit lần hai.

---

## 19. Public API Cho Deposit

### 19.1. Deposit Config

```http
GET /api/v1/deposits/config?asset=USDT
```

Response:

```json
{
  "data": {
    "asset": "USDT",
    "chainId": "31337",
    "tokenAddress": "0xToken...",
    "vaultAddress": "0xVault...",
    "requiredConfirmations": 1
  },
  "requestId": "0197..."
}
```

### 19.2. Create Deposit Intent

```http
POST /api/v1/deposits/intents
```

Request:

```json
{
  "asset": "USDT",
  "depositorAddress": "0x1234..."
}
```

### 19.3. My Deposits

```http
GET /api/v1/deposits?asset=USDT&limit=50&cursor=...
```

### 19.4. Deposit Detail

```http
GET /api/v1/deposits/:depositId
```

User chỉ được xem Deposit của chính mình.

---

## 20. Domain Event Sau Commit

Sau khi credit commit, Backend phát:

```text
DepositUpdated
BalanceUpdated
```

`DepositUpdated` payload tối thiểu:

```json
{
  "depositId": "0197...",
  "userId": "0197...",
  "asset": "USDT",
  "amount": "100.000000000000000000",
  "status": "CREDITED",
  "creditedAt": "2026-07-01T10:35:00.000Z"
}
```

Private WebSocket event:

```text
deposit.updated
balance.updated
```

Chỉ gửi vào room của đúng `userId`.

---

## 21. Security

Sử dụng OpenZeppelin:

```text
ERC20
AccessControl
SafeERC20
Pausable
ReentrancyGuard
```

Rule:

- `ExchangeVault.deposit` dùng `nonReentrant`.
- Dùng `SafeERC20.safeTransferFrom`.
- Faucet và Vault có thể pause.
- Chỉ contract Admin được cấu hình supported token.
- Không lưu email hoặc User ID dạng đọc được on-chain.
- Không credit nếu depositor hoặc token không khớp Intent.
- Không credit trước khi đủ confirmation.
- Private key không được commit vào repository.
- Contract address và chainId lấy từ environment.
- Không cho User truyền arbitrary call data.
- Không hỗ trợ fee-on-transfer token.

---

## 22. Không Thuộc Phạm Vi

Không triển khai:

- Withdrawal.
- Native ETH Deposit.
- Multi-chain.
- Bridge.
- Token swap.
- Upgradeable proxy.
- Multisig.
- Hot wallet.
- Cold wallet.
- Yield.
- KYC on-chain.

---

## 23. Error Code

### Smart Contract Error

```text
UnsupportedToken
InvalidAmount
InvalidAccountReference
DepositReferenceAlreadyUsed
InvalidClaimAmount
FaucetCooldownActive
```

### Backend Error

```text
DEPOSIT_ASSET_NOT_SUPPORTED
DEPOSIT_INTENT_NOT_FOUND
DEPOSIT_INTENT_EXPIRED
DEPOSIT_DEPOSITOR_MISMATCH
DEPOSIT_TOKEN_MISMATCH
DEPOSIT_EVENT_DUPLICATED
DEPOSIT_REFERENCE_ALREADY_USED
DEPOSIT_CONFIRMATION_PENDING
DEPOSIT_ALREADY_CREDITED
DEPOSIT_TRANSACTION_FAILED
```

---

## 24. Deployment

Thứ tự:

```text
1. Deploy Mock ETH.
2. Deploy Mock USDT.
3. Deploy HAU token.
4. Deploy TokenFaucet.
5. Cấp MINTER_ROLE của từng token cho Faucet.
6. Cấu hình supported token và claim amount.
7. Deploy ExchangeVault.
8. Cấu hình supported token trong Vault.
9. Seed contract address vào bảng assets.
10. Cấu hình Backend environment.
11. Start Blockchain Listener.
12. Start Blockchain Deposit Consumer.
13. Start Confirmation Worker.
```

Environment:

```text
BLOCKCHAIN_RPC_URL
BLOCKCHAIN_CHAIN_ID
BLOCKCHAIN_CONFIRMATIONS
EXCHANGE_VAULT_ADDRESS
TOKEN_FAUCET_ADDRESS
```

Private key deploy:

```text
DEPLOYER_PRIVATE_KEY
```

Chỉ dùng trong deploy script, không dùng trong Backend runtime.

---

## 25. Source Layout

```text
contracts/
├── contracts/
│   ├── MockERC20.sol
│   ├── TokenFaucet.sol
│   └── ExchangeVault.sol
│
├── ignition/
│   └── modules/
│       └── HauCEXModule.ts
│
├── scripts/
│   ├── deploy.ts
│   ├── configure-faucet.ts
│   └── configure-vault.ts
│
├── test/
│   ├── MockERC20.test.ts
│   ├── TokenFaucet.test.ts
│   └── ExchangeVault.test.ts
│
├── hardhat.config.ts
├── package.json
└── tsconfig.json
```

Backend:

```text
apps/backend/src/
├── modules/
│   └── deposits/
│       ├── deposits.controller.ts
│       ├── deposits.service.ts
│       ├── deposit-credit.service.ts
│       └── dto/
│
├── workers/
│   ├── blockchain-listener.worker.ts
│   ├── blockchain-deposit.consumer.ts
│   └── deposit-confirmation.worker.ts
│
└── infrastructure/
    └── blockchain/
```

---

## 26. Test Tối Thiểu

### MockERC20

- Minter mint thành công.
- User thường không mint được.
- Decimals đúng.

### TokenFaucet

- Claim supported token thành công.
- Unsupported token bị từ chối.
- Claim amount đúng.
- Cooldown hoạt động.
- Pause chặn claim.

### ExchangeVault

- Deposit sau approve thành công.
- Vault nhận đúng token và amount.
- Event chứa đúng reference, depositor, token và amount.
- Zero amount bị từ chối.
- Zero reference bị từ chối.
- Unsupported token bị từ chối.
- Thiếu allowance bị revert.
- Cùng depositor dùng lại reference bị từ chối.
- Pause chặn Deposit.

### Backend Integration

- Tạo Deposit Intent thành công.
- Event đúng reference ánh xạ đúng User.
- Sai depositor không được credit.
- Sai token không được credit.
- Event trùng không credit lần hai.
- Chưa đủ confirmation chưa credit.
- Đủ confirmation credit đúng amount.
- Wallet và Ledger update atomic.
- Domain Event chỉ phát sau commit.
- Intent hết hạn không nhận event mới.

### End-to-End

```text
User claim Mock USDT
→ tạo Deposit Intent
→ approve ExchangeVault
→ deposit với accountReference
→ Listener phát hiện event
→ DepositDetected
→ chờ confirmation
→ Wallet Available tăng
→ Ledger DEPOSIT được tạo
→ Deposit chuyển CREDITED
→ deposit.updated và balance.updated gửi đúng User
```

---

## 27. Checklist Implementation

- [ ] Mock ERC-20 chỉ cho Minter mint.
- [ ] Một Faucet hỗ trợ nhiều token.
- [ ] Faucet có Claim Amount và Cooldown.
- [ ] Một ExchangeVault hỗ trợ nhiều token.
- [ ] Vault dùng SafeERC20.
- [ ] Vault không nhận native ETH.
- [ ] Deposit event có accountReference.
- [ ] Deposit event có depositor.
- [ ] Deposit event có token.
- [ ] Deposit event có amount.
- [ ] Backend tạo Deposit Intent trước khi gọi Vault.
- [ ] accountReference random và unique.
- [ ] Listener kiểm tra Vault, chain, depositor và token.
- [ ] Event chống trùng bằng chainId + txHash + logIndex.
- [ ] Chờ đủ confirmation trước khi credit.
- [ ] Wallet credit và Ledger nằm cùng transaction.
- [ ] Consumer ghi processed_events.
- [ ] Deposit không credit lần hai.
- [ ] Domain Event chỉ phát sau PostgreSQL commit.
- [ ] Withdrawal không thuộc phạm vi.
