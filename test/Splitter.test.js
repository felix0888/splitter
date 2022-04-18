const { expect } = require("chai");
const { ethers } = require("hardhat");

const { ADDRESS_ZERO, advanceTimeBy } = require("./utils")

describe("Splitter", () => {
  let splitter;
  let mockERC20;
  let owner, alice, bob, carol, signers;

  beforeEach(async () => {
    [owner, alice, bob, carol, signers] = await ethers.getSigners();
    const splitterFactory = await ethers.getContractFactory("Splitter");
    splitter = await splitterFactory.deploy(
      [alice.address, bob.address],
      [10, 30]
    );
    await splitter.deployed();
  });

  describe("deployment", () => {
    it("should set the owner", async () => {
      expect(await splitter.owner()).to.equal(owner.address);
    });

    it("should update user share info", async () => {
      expect(await splitter.userShares(alice.address)).to.equal(10);
      expect(await splitter.userShares(bob.address)).to.equal(30);
      expect(await splitter.userShareSum()).to.equal(40);
    });
  });

  describe("#updateUserShare", () => {
    it("should be reverted if non-owner calls", async () => {
      await expect(
        splitter.connect(alice).updateUserShare([alice.address, bob.address], [10, 30])
      ).to.be.revertedWith(
        "Ownable: caller is not the owner"
      )
    });

    it("should be reverted if invalid inputs given", async () => {
      await expect(
        splitter.updateUserShare([], [])
      ).to.be.revertedWith(
        "Splitter: empty input"
      );

      await expect(
        splitter.updateUserShare([alice.address, bob.address], [10, 20, 30])
      ).to.be.revertedWith(
        "Splitter: length not match"
      );
    });

    it("should update user share info and user share sum", async () => {
      await splitter.updateUserShare([alice.address, bob.address, carol.address], [10, 20, 10]);
      expect(await splitter.userShares(alice.address)).to.equal(10);
      expect(await splitter.userShares(bob.address)).to.equal(20);
      expect(await splitter.userShares(carol.address)).to.equal(10);
      expect(await splitter.userShareSum()).to.equal(40);
    });

    it("should emit event", async () => {
      const users = [alice.address, bob.address];
      const shares = [20, 30];
      await expect(
        splitter.updateUserShare(users, shares)
      ).to.emit(
        splitter, "UpdateUserShare"
      ).withArgs(
        users, shares
      );
    });
  });

  describe("ETH", () => {
    describe("#deposit", () => {
      it("should be reverted if period param is zero", async () => {
        await expect(
          splitter.deposit(0, { value: ethers.utils.parseEther("1")})
        ).to.be.revertedWith(
          "Splitter: invalid pool period"
        );
      });

      it("should create a pool with given params", async () => {
        await splitter.deposit(60 * 60 * 24, { value: ethers.utils.parseEther("2") });
        const newPool = await splitter.pools(1);
        expect(newPool.token).to.equal(ADDRESS_ZERO);
        expect(newPool.balance).to.equal(ethers.utils.parseEther("2"));
        expect(newPool.depositTime).not.to.equal(0);
        expect(newPool.period).to.equal(60 * 60 * 24);
      });

      it("should emit event", async () => {
        await expect(
          splitter.deposit(60 * 60 * 24, { value: ethers.utils.parseEther("2") })
        ).emit(
          splitter, "Deposit"
        ).withArgs(
          1, owner.address, ethers.utils.parseEther("2"), 60 * 60 * 24
        );
      });

      it("should create a pool with default pool period on ETH receive", async () => {
        await alice.sendTransaction({ to: splitter.address, value: ethers.utils.parseEther("2") });
        const newPool = await splitter.pools(1);
        expect(newPool.period).to.equal(2592000);
      });
    });

    describe("#withdraw", async () => {
      beforeEach(async () => {
        await splitter.deposit(2592000, { value: ethers.utils.parseEther("2") })
      });

      it("should be reverted if user not have any share", async () => {
        await expect(
          splitter.connect(carol).withdraw(1)
        ).to.be.revertedWith(
          "Splitter: no pool share"
        );
      });

      it("should be reverted if pool id not exists", async () => {
        await expect(
          splitter.connect(alice).withdraw(2)
        ).to.be.revertedWith(
          "Splitter: invalid pool id"
        );
      });

      it("should transfer ETH(related to user share) if period elapsed", async () => {
        await advanceTimeBy(2592000);

        await expect(
          await splitter.connect(alice).withdraw(1)
        ).to.changeEtherBalance(
          alice, ethers.utils.parseEther("0.5")
        );

        await expect(
          await splitter.connect(bob).withdraw(1)
        ).changeEtherBalance(
          bob, ethers.utils.parseEther("1.5")
        );
      });

      it("should transfer ETH(related to user share and time) if period not elapsed", async () => {
        await advanceTimeBy(1296000);
        await expect(
          await splitter.connect(alice).withdraw(1)
        ).to.changeEtherBalance(
          alice, ethers.utils.parseEther("0.25")
        );

        await advanceTimeBy(648000);
        await expect(
          await splitter.connect(bob).withdraw(1)
        ).to.changeEtherBalance(
          bob, ethers.utils.parseEther("1.125")
        );

        await advanceTimeBy(648000);
        await expect(
          await splitter.connect(alice).withdraw(1)
        ).to.changeEtherBalance(
          alice, ethers.utils.parseEther("0.25")
        );

        await expect(
          await splitter.connect(bob).withdraw(1)
        ).to.changeEtherBalance(
          bob, ethers.utils.parseEther("0.375")
        );
      });
    });
  });

  describe("ERC20 Token", () => {
    beforeEach(async () => {
      const mockERC20Factory = await ethers.getContractFactory("MockERC20");
      mockERC20 = await mockERC20Factory.deploy("Mock Token", "Mock", ethers.utils.parseEther("10000"));
      await mockERC20.deployed();
      await mockERC20.approve(splitter.address, ethers.utils.parseEther("4"));
    });

    describe("#depositToken", () => {
      it("should be reverted if token param is zero address", async () => {
        await expect(
          splitter.depositToken(ADDRESS_ZERO, ethers.utils.parseEther("4"), 2592000)
        ).to.be.revertedWith(
          "Splitter: invalid token address"
        );
      });

      it("should be reverted if amount param is zero", async () => {
        await expect(
          splitter.depositToken(mockERC20.address, 0, 2592000)
        ).to.be.revertedWith(
          "Splitter: insufficient deposit"
        );
      });

      it("should be reverted if period param is zero", async () => {
        await expect(
          splitter.depositToken(mockERC20.address, ethers.utils.parseEther("4"), 0)
        ).to.be.revertedWith(
          "Splitter: invalid pool period"
        );
      });

      it("should create a pool with given params", async () => {
        await splitter.depositToken(mockERC20.address, ethers.utils.parseEther("4"), 60 * 60 * 24);
        const newPool = await splitter.pools(1);
        expect(newPool.token).to.equal(mockERC20.address);
        expect(newPool.balance).to.equal(ethers.utils.parseEther("4"));
        expect(newPool.depositTime).not.to.equal(0);
        expect(newPool.period).to.equal(60 * 60 * 24);
      });

      it("should emit event", async () => {
        await expect(
          splitter.depositToken(mockERC20.address, ethers.utils.parseEther("4"), 60 * 60 * 24)
        ).emit(
          splitter, "DepositToken"
        ).withArgs(
          1, owner.address, mockERC20.address, ethers.utils.parseEther("4"), 60 * 60 * 24
        );
      });
    });

    describe("#withdraw", async () => {
      beforeEach(async () => {
        await splitter.depositToken(mockERC20.address, ethers.utils.parseEther("4"), 2592000);
      });

      it("should be reverted if user not have any share", async () => {
        await expect(
          splitter.connect(carol).withdraw(1)
        ).to.be.revertedWith(
          "Splitter: no pool share"
        );
      });

      it("should be reverted if pool id not exists", async () => {
        await expect(
          splitter.connect(alice).withdraw(2)
        ).to.be.revertedWith(
          "Splitter: invalid pool id"
        );
      });

      it("should transfer Token(related to user share) if period elapsed", async () => {
        await advanceTimeBy(2592000);

        let aliceBeforeBalance = await mockERC20.balanceOf(alice.address);
        await splitter.connect(alice).withdraw(1);
        let aliceAfterBalance = await mockERC20.balanceOf(alice.address);
        expect(aliceAfterBalance.sub(aliceBeforeBalance)).to.equal(ethers.utils.parseEther("1"));

        let bobBeforeBalance = await mockERC20.balanceOf(bob.address);
        await splitter.connect(bob).withdraw(1);
        let bobAfterBalance = await mockERC20.balanceOf(bob.address);
        expect(bobAfterBalance.sub(bobBeforeBalance)).to.equal(ethers.utils.parseEther("3"));
      });

      it("should transfer Token(related to user share and time) if period not elapsed", async () => {
        await advanceTimeBy(1296000);

        let aliceBeforeBalance, aliceAfterBalance, bobBeforeBalance, bobAfterBalance;
        aliceBeforeBalance = await mockERC20.balanceOf(alice.address);
        await splitter.connect(alice).withdraw(1)
        aliceAfterBalance = await mockERC20.balanceOf(alice.address);
        expect(aliceAfterBalance.sub(aliceBeforeBalance)).to.equal(ethers.utils.parseEther("0.5"));

        await advanceTimeBy(648000);
        bobBeforeBalance = await mockERC20.balanceOf(bob.address);
        await splitter.connect(bob).withdraw(1);
        bobAfterBalance = await mockERC20.balanceOf(bob.address);
        expect(bobAfterBalance.sub(bobBeforeBalance)).to.equal(ethers.utils.parseEther("2.25"));

        await advanceTimeBy(648000);
        aliceBeforeBalance = aliceAfterBalance;
        await splitter.connect(alice).withdraw(1);
        aliceAfterBalance = await mockERC20.balanceOf(alice.address);
        expect(aliceAfterBalance.sub(aliceBeforeBalance)).to.equal(ethers.utils.parseEther("0.5"));

        bobBeforeBalance = bobAfterBalance;
        await splitter.connect(bob).withdraw(1);
        bobAfterBalance = await mockERC20.balanceOf(bob.address);
        expect(bobAfterBalance.sub(bobBeforeBalance)).to.equal(ethers.utils.parseEther("0.75"));
      });
    });
  });
});
