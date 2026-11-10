# Kaptora Face Scan

Kaptora Face Scan — captura facial guiada (9 vistas) da Drawn Face Academy.
Abra pelo link do GitHub Pages no celular e permita a câmera. pUBLICADO POR SANDRO


## Estrutura (Kaptora Face Scan)

- `index.html` — página de entrada: login da equipe, Início, Pacientes (ficha com histórico), Configurações (identidade e equipe da clínica), Perfil.
- `captura.html` — captura facial guiada (9 vistas). Aberta pela ficha, salva as fotos direto na ficha da paciente.
- `painel.html` — tela ao vivo no tablet/TV.
- `admin.html` — super admin: clínicas (white label), módulos, licenças.
- Servidor de contas: Supabase (projeto "Kaptora System", São Paulo). Fotos em armazenamento privado por clínica; cada clínica só enxerga os próprios dados (RLS).
