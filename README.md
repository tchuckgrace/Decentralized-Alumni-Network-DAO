# 🌐 Decentralized Alumni Network DAO

Welcome to a revolutionary way to connect alumni, foster community contributions, and fund scholarships transparently! This project creates a decentralized autonomous organization (DAO) on the Stacks blockchain, where alumni can verify their membership, contribute to the network (e.g., mentorship, donations, events), and collectively decide on scholarship funding based on verified contributions. It solves real-world problems like centralized alumni networks that lack transparency, inefficient scholarship allocation, and unverified member engagement, leading to fairer, merit-based funding.

## ✨ Features

🔗 Verified alumni membership to ensure authenticity  
🤝 Track and verify contributions (e.g., time, funds, knowledge sharing)  
🗳️ DAO governance for voting on scholarship proposals  
💰 Treasury management for secure fund handling  
📊 Merit-based scholarship distribution tied to member contributions  
🔒 Immutable records of all activities on the blockchain  
🏆 Reward system for active contributors  
📈 Analytics for network growth and impact reporting  
🚀 Easy integration with external verifiers (e.g., university APIs via oracles)  

## 🛠 How It Works

**For Alumni Members**  
- Verify your alumni status by submitting proof (e.g., diploma hash or university confirmation).  
- Join the DAO by calling the membership contract.  
- Submit contributions (e.g., donate STX, log mentorship hours) via the contribution tracking contract.  
- Earn governance tokens based on verified contributions to participate in voting.  

**For Contributors and Proposers**  
- Propose scholarships by detailing recipient needs, criteria, and amount.  
- Use the voting contract to rally support from token holders.  
- Verified contributions boost your voting power or eligibility for rewards.  

**For Scholarship Recipients and Verifiers**  
- Apply for scholarships through proposals.  
- Once approved, funds are disbursed from the treasury.  
- Anyone can query the blockchain to verify contribution histories and funding decisions.  

That's it! A transparent, decentralized system that empowers alumni to give back and support the next generation.

## 📜 Smart Contracts Overview

This project is built using Clarity on the Stacks blockchain and involves 8 smart contracts for modularity, security, and scalability:  

1. **MembershipContract**: Handles alumni verification, registration, and membership NFTs/tokens.  
2. **ContributionTracker**: Records and verifies member contributions (e.g., via hashes or oracle inputs).  
3. **GovernanceToken**: Manages the ERC-20-like token for voting power, earned through contributions.  
4. **VotingContract**: Facilitates proposal creation, voting, and execution based on token-weighted votes.  
5. **TreasuryContract**: Securely holds and manages DAO funds, including deposits and withdrawals.  
6. **ScholarshipProposal**: Specific contract for creating, reviewing, and approving scholarship grants.  
7. **RewardDistributor**: Automates rewards for contributors based on verified metrics.  
8. **OracleIntegrator**: Interfaces with external data sources for verification (e.g., university records).  

These contracts interact seamlessly: For example, a verified contribution in ContributionTracker mints tokens in GovernanceToken, which are used in VotingContract to approve funds from TreasuryContract for scholarships. Deploy them on Stacks for a fully decentralized alumni ecosystem!