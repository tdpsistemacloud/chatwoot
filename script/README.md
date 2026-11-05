# Scripts operacionais

Esta pasta reúne os pontos de entrada shell de operação do INPERA Chat.
Execute os comandos a partir da raiz do checkout.

| Script                                                               | Finalidade                                                 | Ambiente de execução                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| [Deploy_Prod.sh](Deploy_Prod.sh)                                     | Build, empacotamento e publicação da produção              | Git Bash no PC, com Docker e PuTTY                                   |
| [diagnostico-hostgator.sh](diagnostico-hostgator.sh)                 | Consulta containers, filas Redis e relatórios no HostGator | Shell do servidor, com Docker e os containers esperados pelo arquivo |
| [install_nginx_ssl_inpera_chat.sh](install_nginx_ssl_inpera_chat.sh) | Instala Nginx e configura SSL                              | Servidor Linux com privilégios administrativos                       |
| [sync_upstream_branches.sh](sync_upstream_branches.sh)               | Prepara uma release upstream para revisão                  | Bash, Git, Node 24 e GitHub CLI autenticado                          |

O deploy exige autorização explícita e as validações descritas na
[documentação INPERA](../docs/inpera/README.md). O diagnóstico utiliza nomes
fixos de containers; confira o ambiente antes de executá-lo.

Os utilitários Ruby foram organizados em [tools/](../tools/README.md), separados
em manutenção, atualização do Rails e legado. A linguagem, sozinha, não define
a finalidade de um script: novas ferramentas devem ser classificadas pelo uso.
