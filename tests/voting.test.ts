 
import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, principalCV, boolCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_PROPOSAL_AMOUNT = 101;
const ERR_INVALID_VOTING_PERIOD = 102;
const ERR_INVALID_QUORUM_THRESHOLD = 103;
const ERR_PROPOSAL_ALREADY_EXISTS = 104;
const ERR_PROPOSAL_NOT_FOUND = 105;
const ERR_VOTING_CLOSED = 106;
const ERR_ALREADY_VOTED = 107;
const ERR_INSUFFICIENT_TOKENS = 108;
const ERR_PROPOSAL_EXECUTED = 109;
const ERR_PROPOSAL_NOT_APPROVED = 110;
const ERR_INVALID_RECIPIENT = 111;
const ERR_INVALID_DESCRIPTION = 112;
const ERR_INVALID_TITLE = 113;
const ERR_TREASURY_NOT_SET = 114;
const ERR_GOV_TOKEN_NOT_SET = 115;
const ERR_MAX_PROPOSALS_EXCEEDED = 119;

interface Proposal {
  title: string;
  description: string;
  amount: number;
  recipient: string;
  proposer: string;
  startHeight: number;
  endHeight: number;
  yesVotes: number;
  noVotes: number;
  executed: boolean;
  status: boolean;
}

interface Vote {
  vote: boolean;
  tokens: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class VotingContractMock {
  state: {
    nextProposalId: number;
    maxProposals: number;
    proposalFee: number;
    treasuryContract: string | null;
    govTokenContract: string | null;
    quorumThreshold: number;
    proposals: Map<number, Proposal>;
    proposalsByTitle: Map<string, number>;
    votes: Map<string, Vote>;
  } = {
    nextProposalId: 0,
    maxProposals: 1000,
    proposalFee: 100,
    treasuryContract: null,
    govTokenContract: null,
    quorumThreshold: 50,
    proposals: new Map(),
    proposalsByTitle: new Map(),
    votes: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];
  tokenBalances: Map<string, number> = new Map([["ST1TEST", 1000]]);
  treasuryTransfers: Array<{ amount: number; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextProposalId: 0,
      maxProposals: 1000,
      proposalFee: 100,
      treasuryContract: null,
      govTokenContract: null,
      quorumThreshold: 50,
      proposals: new Map(),
      proposalsByTitle: new Map(),
      votes: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.tokenBalances = new Map([["ST1TEST", 1000]]);
    this.treasuryTransfers = [];
  }

  setTreasuryContract(contract: string): Result<boolean> {
    if (this.caller !== "ST1TEST") return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.treasuryContract = contract;
    return { ok: true, value: true };
  }

  setGovTokenContract(contract: string): Result<boolean> {
    if (this.caller !== "ST1TEST") return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.govTokenContract = contract;
    return { ok: true, value: true };
  }

  setQuorumThreshold(newQuorum: number): Result<boolean> {
    if (this.caller !== "ST1TEST") return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newQuorum <= 0 || newQuorum > 100) return { ok: false, value: ERR_INVALID_QUORUM_THRESHOLD };
    this.state.quorumThreshold = newQuorum;
    return { ok: true, value: true };
  }

  createProposal(
    title: string,
    description: string,
    amount: number,
    recipient: string,
    votingPeriod: number
  ): Result<number> {
    if (this.state.nextProposalId >= this.state.maxProposals) return { ok: false, value: ERR_MAX_PROPOSALS_EXCEEDED };
    if (!title || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (!description || description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_PROPOSAL_AMOUNT };
    if (recipient === this.caller) return { ok: false, value: ERR_INVALID_RECIPIENT };
    const start = this.blockHeight;
    const end = this.blockHeight + votingPeriod;
    if (start < this.blockHeight || end <= start) return { ok: false, value: ERR_INVALID_VOTING_PERIOD };
    if (this.state.proposalsByTitle.has(title)) return { ok: false, value: ERR_PROPOSAL_ALREADY_EXISTS };
    if (!this.state.treasuryContract) return { ok: false, value: ERR_TREASURY_NOT_SET };
    this.stxTransfers.push({ amount: this.state.proposalFee, from: this.caller, to: this.state.treasuryContract });
    const id = this.state.nextProposalId;
    const proposal: Proposal = {
      title,
      description,
      amount,
      recipient,
      proposer: this.caller,
      startHeight: start,
      endHeight: end,
      yesVotes: 0,
      noVotes: 0,
      executed: false,
      status: true,
    };
    this.state.proposals.set(id, proposal);
    this.state.proposalsByTitle.set(title, id);
    this.state.nextProposalId++;
    return { ok: true, value: id };
  }

  voteOnProposal(proposalId: number, vote: boolean): Result<boolean> {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    if (this.blockHeight < proposal.startHeight || this.blockHeight >= proposal.endHeight) return { ok: false, value: ERR_VOTING_CLOSED };
    const voteKey = `${proposalId}-${this.caller}`;
    if (this.state.votes.has(voteKey)) return { ok: false, value: ERR_ALREADY_VOTED };
    if (!this.state.govTokenContract) return { ok: false, value: ERR_GOV_TOKEN_NOT_SET };
    const tokens = this.tokenBalances.get(this.caller) || 0;
    if (tokens <= 0) return { ok: false, value: ERR_INSUFFICIENT_TOKENS };
    this.state.votes.set(voteKey, { vote, tokens });
    if (vote) {
      proposal.yesVotes += tokens;
    } else {
      proposal.noVotes += tokens;
    }
    this.state.proposals.set(proposalId, proposal);
    return { ok: true, value: true };
  }

  executeProposal(proposalId: number): Result<boolean> {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return { ok: false, value: ERR_PROPOSAL_NOT_FOUND };
    if (this.blockHeight < proposal.endHeight) return { ok: false, value: ERR_VOTING_CLOSED };
    if (proposal.executed) return { ok: false, value: ERR_PROPOSAL_EXECUTED };
    const totalVotes = proposal.yesVotes + proposal.noVotes;
    const quorum = (totalVotes * this.state.quorumThreshold) / 100;
    if (proposal.yesVotes <= quorum) return { ok: false, value: ERR_PROPOSAL_NOT_APPROVED };
    if (!this.state.treasuryContract) return { ok: false, value: ERR_TREASURY_NOT_SET };
    this.treasuryTransfers.push({ amount: proposal.amount, to: proposal.recipient });
    proposal.executed = true;
    this.state.proposals.set(proposalId, proposal);
    return { ok: true, value: true };
  }

  getProposalCount(): Result<number> {
    return { ok: true, value: this.state.nextProposalId };
  }
}

describe("VotingContract", () => {
  let contract: VotingContractMock;

  beforeEach(() => {
    contract = new VotingContractMock();
    contract.reset();
  });

  it("creates a proposal successfully", () => {
    contract.setTreasuryContract("ST2TEST");
    contract.setGovTokenContract("ST3TEST");
    const result = contract.createProposal("Scholarship1", "Fund tuition", 500, "ST4RECIP", 100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const proposal = contract.state.proposals.get(0);
    expect(proposal?.title).toBe("Scholarship1");
    expect(proposal?.amount).toBe(500);
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate proposal titles", () => {
    contract.setTreasuryContract("ST2TEST");
    contract.setGovTokenContract("ST3TEST");
    contract.createProposal("Scholarship1", "Fund tuition", 500, "ST4RECIP", 100);
    const result = contract.createProposal("Scholarship1", "Another desc", 600, "ST5RECIP", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROPOSAL_ALREADY_EXISTS);
  });

  it("rejects proposal without treasury", () => {
    contract.setGovTokenContract("ST3TEST");
    const result = contract.createProposal("NoTreasury", "Desc", 500, "ST4RECIP", 100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_TREASURY_NOT_SET);
  });

  it("votes on proposal successfully", () => {
    contract.setTreasuryContract("ST2TEST");
    contract.setGovTokenContract("ST3TEST");
    contract.createProposal("Scholarship1", "Fund tuition", 500, "ST4RECIP", 100);
    contract.blockHeight = 10;
    const result = contract.voteOnProposal(0, true);
    expect(result.ok).toBe(true);
    const proposal = contract.state.proposals.get(0);
    expect(proposal?.yesVotes).toBe(1000);
  });

  it("rejects vote after period", () => {
    contract.setTreasuryContract("ST2TEST");
    contract.setGovTokenContract("ST3TEST");
    contract.createProposal("Scholarship1", "Fund tuition", 500, "ST4RECIP", 100);
    contract.blockHeight = 101;
    const result = contract.voteOnProposal(0, true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_VOTING_CLOSED);
  });

  it("rejects double vote", () => {
    contract.setTreasuryContract("ST2TEST");
    contract.setGovTokenContract("ST3TEST");
    contract.createProposal("Scholarship1", "Fund tuition", 500, "ST4RECIP", 100);
    contract.blockHeight = 10;
    contract.voteOnProposal(0, true);
    const result = contract.voteOnProposal(0, false);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_VOTED);
  });

  it("executes proposal successfully", () => {
    contract.setTreasuryContract("ST2TEST");
    contract.setGovTokenContract("ST3TEST");
    contract.createProposal("Scholarship1", "Fund tuition", 500, "ST4RECIP", 100);
    contract.blockHeight = 10;
    contract.voteOnProposal(0, true);
    contract.blockHeight = 101;
    const result = contract.executeProposal(0);
    expect(result.ok).toBe(true);
    const proposal = contract.state.proposals.get(0);
    expect(proposal?.executed).toBe(true);
    expect(contract.treasuryTransfers).toEqual([{ amount: 500, to: "ST4RECIP" }]);
  });

  it("rejects execution before end", () => {
    contract.setTreasuryContract("ST2TEST");
    contract.setGovTokenContract("ST3TEST");
    contract.createProposal("Scholarship1", "Fund tuition", 500, "ST4RECIP", 100);
    contract.blockHeight = 50;
    const result = contract.executeProposal(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_VOTING_CLOSED);
  });

  it("rejects execution if not approved", () => {
    contract.setTreasuryContract("ST2TEST");
    contract.setGovTokenContract("ST3TEST");
    contract.createProposal("Scholarship1", "Fund tuition", 500, "ST4RECIP", 100);
    contract.blockHeight = 10;
    contract.voteOnProposal(0, false);
    contract.blockHeight = 101;
    const result = contract.executeProposal(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROPOSAL_NOT_APPROVED);
  });

  it("sets quorum threshold successfully", () => {
    const result = contract.setQuorumThreshold(60);
    expect(result.ok).toBe(true);
    expect(contract.state.quorumThreshold).toBe(60);
  });

  it("rejects invalid quorum", () => {
    const result = contract.setQuorumThreshold(101);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_QUORUM_THRESHOLD);
  });

  it("gets proposal count correctly", () => {
    contract.setTreasuryContract("ST2TEST");
    contract.setGovTokenContract("ST3TEST");
    contract.createProposal("Scholarship1", "Fund tuition", 500, "ST4RECIP", 100);
    contract.createProposal("Scholarship2", "Fund books", 300, "ST5RECIP", 150);
    const result = contract.getProposalCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });
});