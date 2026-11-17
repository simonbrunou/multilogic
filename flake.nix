{
  description = "multilogic dev shell";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";  # ponytail: single machine; add flake-utils for multi-arch
      pkgs = import nixpkgs { inherit system; };
      inherit (pkgs) lib;

      # packageManager in package.json is the one Bun pin (#96), and the shell's bun comes from
      # the nixpkgs that flake.lock locks. Every shell entry (nix develop, nix develop -c, direnv)
      # warns when the two leave the same major.minor (#111). See AGENTS.md "Bun version".
      shellBun = pkgs.bun.version;
      pin = (builtins.fromJSON (builtins.readFile ./package.json)).packageManager or null;
      # bun@1.4.4, also with a prerelease or a corepack hash: bun@1.5.0-canary.1, bun@1.4.4+sha512.<hex>.
      # pinVersion keeps the prerelease and drops the hash.
      pinMatch = if builtins.isString pin then builtins.match "bun@(([0-9]+)\\.([0-9]+)\\.[0-9]+(-[^+]+)?)(\\+.*)?" pin else null;
      pinVersion = builtins.elemAt pinMatch 0;
      pinMinor = "${builtins.elemAt pinMatch 1}.${builtins.elemAt pinMatch 2}";
      bunWarning =
        if pinMatch == null then
          "package.json packageManager is ${builtins.toJSON pin}, not bun@<version>, so the dev shell cannot compare its Bun ${shellBun} with the pin"
        else if pinMinor != lib.versions.majorMinor shellBun then
          "dev shell Bun ${shellBun} is not on the packageManager pin's major and minor (bun@${pinVersion}). "
          + (if lib.versionOlder shellBun pinVersion
            then "Run `nix flake update` once nixpkgs carries Bun ${pinMinor}"
            else "Move the pin to Bun ${lib.versions.majorMinor shellBun}, or keep flake.lock on a nixpkgs that carries Bun ${pinMinor}")
          + "; until then write any bun.lock change with `bunx bun@${pinVersion} install`"
        else null;
    in {
      devShells.x86_64-linux.default = lib.warnIf (bunWarning != null) bunWarning (pkgs.mkShell {
        packages = with pkgs; [ nodejs_26 bun ];
      });
    };
}
