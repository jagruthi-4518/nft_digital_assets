// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract mint_algo is ERC721URIStorage, Ownable {

    uint256 private nextTokenId = 1;

    struct Asset {
        string assetName;
        string contentHash;
        uint256 mintedAt;
    }

    mapping(uint256 => Asset) public assets;
    mapping(string => bool) private usedHashes;
    mapping(string => bool) private usedNames;

    event AssetMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string assetName,
        string contentHash

    );

    constructor() ERC721("NFT Demo", "NFTD") Ownable(msg.sender) {}

    function mintNFT(
        string memory assetName,
        string memory contentHash,
        string memory tokenURI_
    ) public {
        require(!usedHashes[contentHash], "Content already minted");
        require(!usedNames[assetName], "Asset name already exists");
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        assets[tokenId] = Asset({
            assetName: assetName,
            contentHash: contentHash,
            mintedAt: block.timestamp
        });
        usedHashes[contentHash] = true;
        usedNames[assetName] = true;

        emit AssetMinted(tokenId, msg.sender, assetName, contentHash);
    }

    function verifyHash(
        uint256 tokenId,
        string memory hash
    )
        public
        view
        returns(bool)

    {
        return keccak256(bytes(assets[tokenId].contentHash))
            ==
            keccak256(bytes(hash));

    }

    function getAsset(
        uint256 tokenId
    )

        public
        view

        returns(
            string memory,
            string memory,
            address,
            uint256
        )

    {
        return (
            assets[tokenId].assetName,
            assets[tokenId].contentHash,
            ownerOf(tokenId),
            assets[tokenId].mintedAt
        );
    }
}