(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PROPOSAL-AMOUNT u101)
(define-constant ERR-INVALID-VOTING-PERIOD u102)
(define-constant ERR-INVALID-QUORUM-THRESHOLD u103)
(define-constant ERR-PROPOSAL-ALREADY-EXISTS u104)
(define-constant ERR-PROPOSAL-NOT-FOUND u105)
(define-constant ERR-VOTING-CLOSED u106)
(define-constant ERR-ALREADY-VOTED u107)
(define-constant ERR-INSUFFICIENT-TOKENS u108)
(define-constant ERR-PROPOSAL-EXECUTED u109)
(define-constant ERR-PROPOSAL-NOT-APPROVED u110)
(define-constant ERR-INVALID-RECIPIENT u111)
(define-constant ERR-INVALID-DESCRIPTION u112)
(define-constant ERR-INVALID-TITLE u113)
(define-constant ERR-TREASURY-NOT-SET u114)
(define-constant ERR-GOV-TOKEN-NOT-SET u115)
(define-constant ERR-INVALID-START-HEIGHT u116)
(define-constant ERR-INVALID-END-HEIGHT u117)
(define-constant ERR-INVALID-VOTE u118)
(define-constant ERR-MAX-PROPOSALS-EXCEEDED u119)
(define-constant ERR-INVALID-STATUS u120)

(define-data-var next-proposal-id uint u0)
(define-data-var max-proposals uint u1000)
(define-data-var proposal-fee uint u100)
(define-data-var treasury-contract (optional principal) none)
(define-data-var gov-token-contract (optional principal) none)
(define-data-var quorum-threshold uint u50)

(define-map proposals
  uint
  {
    title: (string-utf8 100),
    description: (string-utf8 500),
    amount: uint,
    recipient: principal,
    proposer: principal,
    start-height: uint,
    end-height: uint,
    yes-votes: uint,
    no-votes: uint,
    executed: bool,
    status: bool
  }
)

(define-map proposals-by-title
  (string-utf8 100)
  uint)

(define-map votes
  { proposal-id: uint, voter: principal }
  { vote: bool, tokens: uint }
)

(define-read-only (get-proposal (id uint))
  (map-get? proposals id)
)

(define-read-only (get-vote (id uint) (voter principal))
  (map-get? votes { proposal-id: id, voter: voter })
)

(define-read-only (is-proposal-registered (title (string-utf8 100)))
  (is-some (map-get? proposals-by-title title))
)

(define-private (validate-title (title (string-utf8 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR-INVALID-TITLE))
)

(define-private (validate-description (desc (string-utf8 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-amount (amt uint))
  (if (> amt u0)
      (ok true)
      (err ERR-INVALID-PROPOSAL-AMOUNT))
)

(define-private (validate-recipient (rec principal))
  (if (not (is-eq rec tx-sender))
      (ok true)
      (err ERR-INVALID-RECIPIENT))
)

(define-private (validate-voting-period (start uint) (end uint))
  (if (and (>= start block-height) (> end start))
      (ok true)
      (err ERR-INVALID-VOTING-PERIOD))
)

(define-private (validate-quorum (quorum uint))
  (if (and (> quorum u0) (<= quorum u100))
      (ok true)
      (err ERR-INVALID-QUORUM-THRESHOLD))
)

(define-private (validate-vote-type (vote bool))
  (ok true)
)

(define-private (validate-status (status bool))
  (ok true)
)

(define-private (get-token-balance (owner principal))
  (unwrap! (contract-call? (unwrap! (var-get gov-token-contract) (err ERR-GOV-TOKEN-NOT-SET)) balance-of owner) (err ERR-INSUFFICIENT-TOKENS))
)

(define-public (set-treasury-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender contract-caller) (err ERR-NOT-AUTHORIZED))
    (var-set treasury-contract (some contract))
    (ok true)
  )
)

(define-public (set-gov-token-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender contract-caller) (err ERR-NOT-AUTHORIZED))
    (var-set gov-token-contract (some contract))
    (ok true)
  )
)

(define-public (set-quorum-threshold (new-quorum uint))
  (begin
    (asserts! (is-eq tx-sender contract-caller) (err ERR-NOT-AUTHORIZED))
    (try! (validate-quorum new-quorum))
    (var-set quorum-threshold new-quorum)
    (ok true)
  )
)

(define-public (create-proposal
  (title (string-utf8 100))
  (description (string-utf8 500))
  (amount uint)
  (recipient principal)
  (voting-period uint)
)
  (let (
        (next-id (var-get next-proposal-id))
        (current-max (var-get max-proposals))
        (start block-height)
        (end (+ block-height voting-period))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-PROPOSALS-EXCEEDED))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (validate-amount amount))
    (try! (validate-recipient recipient))
    (try! (validate-voting-period start end))
    (asserts! (is-none (map-get? proposals-by-title title)) (err ERR-PROPOSAL-ALREADY-EXISTS))
    (try! (stx-transfer? (var-get proposal-fee) tx-sender (unwrap! (var-get treasury-contract) (err ERR-TREASURY-NOT-SET))))
    (map-set proposals next-id
      {
        title: title,
        description: description,
        amount: amount,
        recipient: recipient,
        proposer: tx-sender,
        start-height: start,
        end-height: end,
        yes-votes: u0,
        no-votes: u0,
        executed: false,
        status: true
      }
    )
    (map-set proposals-by-title title next-id)
    (var-set next-proposal-id (+ next-id u1))
    (print { event: "proposal-created", id: next-id })
    (ok next-id)
  )
)

(define-public (vote-on-proposal (proposal-id uint) (vote bool))
  (let ((proposal (unwrap! (map-get? proposals proposal-id) (err ERR-PROPOSAL-NOT-FOUND))))
    (asserts! (>= block-height (get start-height proposal)) (err ERR-VOTING-CLOSED))
    (asserts! (< block-height (get end-height proposal)) (err ERR-VOTING-CLOSED))
    (asserts! (is-none (map-get? votes { proposal-id: proposal-id, voter: tx-sender })) (err ERR-ALREADY-VOTED))
    (let ((tokens (get-token-balance tx-sender)))
      (asserts! (> tokens u0) (err ERR-INSUFFICIENT-TOKENS))
      (map-set votes { proposal-id: proposal-id, voter: tx-sender } { vote: vote, tokens: tokens })
      (if vote
          (map-set proposals proposal-id (merge proposal { yes-votes: (+ (get yes-votes proposal) tokens) }))
          (map-set proposals proposal-id (merge proposal { no-votes: (+ (get no-votes proposal) tokens) })))
      (print { event: "vote-cast", proposal-id: proposal-id, voter: tx-sender, vote: vote })
      (ok true)
    )
  )
)

(define-public (execute-proposal (proposal-id uint))
  (let ((proposal (unwrap! (map-get? proposals proposal-id) (err ERR-PROPOSAL-NOT-FOUND))))
    (asserts! (>= block-height (get end-height proposal)) (err ERR-VOTING-CLOSED))
    (asserts! (not (get executed proposal)) (err ERR-PROPOSAL-EXECUTED))
    (let ((total-votes (+ (get yes-votes proposal) (get no-votes proposal)))
          (quorum (* total-votes (var-get quorum-threshold) / u100)))
      (asserts! (> (get yes-votes proposal) quorum) (err ERR-PROPOSAL-NOT-APPROVED))
      (try! (as-contract (contract-call? (unwrap! (var-get treasury-contract) (err ERR-TREASURY-NOT-SET)) transfer (get amount proposal) (get recipient proposal))))
      (map-set proposals proposal-id (merge proposal { executed: true }))
      (print { event: "proposal-executed", id: proposal-id })
      (ok true)
    )
  )
)

(define-public (get-proposal-count)
  (ok (var-get next-proposal-id))
)