// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * TrustScoreAttestation
 * ------------------------------------------------------------
 * IMPORTANT — WHAT THIS CONTRACT DOES AND DOES NOT PROVE:
 *
 *   It proves:      "This claim was signed by an address the contract
 *                    owner has authorized as a verification service."
 *
 *   It does NOT prove: that the underlying real-world worker data
 *                    (income, rating, completion rate, etc.) is true.
 *
 * No raw worker financial data is ever written on-chain. Only a hash
 * of the claim and the signer's address are recorded. This is a
 * hackathon prototype demonstrating the authorization pattern —
 * it is not connected to any real verification service.
 *
 * Remix-compatible. No external imports required.
 */
contract TrustScoreAttestation {
    address public owner;

    // Addresses allowed to submit attestations (e.g. a verification service key).
    mapping(address => bool) public authorizedSigners;

    struct Attestation {
        bytes32 claimHash;   // hash of the off-chain claim (worker id + signal snapshot), never raw data
        address signer;
        uint256 timestamp;
        bool accepted;
    }

    mapping(bytes32 => Attestation) public attestations; // claimHash => Attestation

    event SignerAuthorized(address indexed signer);
    event SignerRevoked(address indexed signer);
    event AttestationAccepted(bytes32 indexed claimHash, address indexed signer, uint256 timestamp);
    event AttestationRejected(bytes32 indexed claimHash, address indexed signer, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function authorizeSigner(address signer) external onlyOwner {
        authorizedSigners[signer] = true;
        emit SignerAuthorized(signer);
    }

    function revokeSigner(address signer) external onlyOwner {
        authorizedSigners[signer] = false;
        emit SignerRevoked(signer);
    }

    /**
     * Submit a claim hash. Only an authorized signer's submission is
     * accepted. Unauthorized submissions are explicitly recorded as
     * rejected (not silently dropped) so the UI can demo both paths.
     */
    function submitAttestation(bytes32 claimHash) external {
        bool ok = authorizedSigners[msg.sender];

        attestations[claimHash] = Attestation({
            claimHash: claimHash,
            signer: msg.sender,
            timestamp: block.timestamp,
            accepted: ok
        });

        if (ok) {
            emit AttestationAccepted(claimHash, msg.sender, block.timestamp);
        } else {
            emit AttestationRejected(claimHash, msg.sender, block.timestamp);
        }
    }

    function isAccepted(bytes32 claimHash) external view returns (bool) {
        return attestations[claimHash].accepted;
    }
}
