{
  description = "ctrl.page dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        tsgo = pkgs.buildGo126Module {
          pname = "tsgo";
          version = "unstable-2026-03-01";

          src = pkgs.fetchFromGitHub {
            owner = "microsoft";
            repo = "typescript-go";
            rev = "0a7d128ada55f48fdcf84296473d8b2f469605ff";
            hash = "sha256-WrRpZeQEkYvOw31DKdvX6iksNP/dsO2Ol5vwUw5IA64=";
          };

          vendorHash = "sha256-dUO6rCw8BrIJ+igFrntTIro4k1PH69G2J1IWPKsGzfM=";

          subPackages = [ "cmd/tsgo" ];
        };

     in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.bun
            tsgo
          ];
        };
      }
    );
}
