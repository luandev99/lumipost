# 04 — Storage, uploads e assets

## Prompt da fase

Implemente Storage privado e migre uploads/biblioteca. Preserve o upload por formato e elimine URLs blob como persistência.

## Buckets

Crie via migration/configuração reproduzível:

- `brand-assets`;
- `content-uploads`;
- `generated-media`;
- `content-renders`;
- `template-specs`;
- `exports`.

Somente ativos institucionais sem dados de cliente podem ser públicos.

## Path obrigatório

```text
<organization_id>/<brand_id>/<resource_id>/<version>/<safe-filename>
```

O servidor gera o path. Nunca aceite path completo arbitrário do cliente, `..`, slash inicial ou mudança de tenant.

## Fluxo

1. `upload-authorize` valida JWT, org/role, MIME declarado, tamanho, formato e quota.
2. Retorna signed upload URL curta para path gerado.
3. Cliente envia diretamente.
4. `upload-finalize` consulta o objeto, valida metadata e cria `storage_objects`.
5. Validação pesada vira job; o objeto fica `quarantined` até aprovação.
6. Preview/download recebe signed URL curta gerada sob demanda.

Não grave signed URL; grave bucket/path. Para vídeo grande use upload resumível suportado.

## Validações

- Post: uma imagem permitida.
- Carrossel: 2–10 imagens ordenadas.
- Story: uma imagem vertical.
- Reel: MP4, limite de bytes/duração/resolução; capa opcional.
- Compare MIME real, magic bytes e extensão.
- Normalize filename; gere UUID no path.
- Bloqueie SVG/HTML não confiável ou sanitize antes de servir.
- Calcule SHA-256 para deduplicação/auditoria.
- Não use conteúdo enviado como header HTTP sem sanitização.

## RLS do Storage

Policies em `storage.objects` validam bucket e primeiro segmento do path contra organização acessível. Teste `SELECT`, `INSERT`, `UPDATE`, `DELETE` separadamente. Service key pode ignorar RLS, então Edge Functions ainda devem validar ownership.

## Limpeza

- uploads não finalizados/quarentena vencida;
- signed URLs curtas;
- exports temporários;
- deleção lógica primeiro, purge assíncrono depois;
- não remover objeto referenciado por versão publicada.

## Templates

Importe metadados dos 728 templates ao Postgres e specs imutáveis em `template-specs`, com SHA-256 e versão. Valide round-trip dos ZIPs.

## Testes

- upload permitido;
- MIME/tamanho/extensão inválidos;
- tentativa de path de outro tenant;
- URL expirada;
- carrossel fora de 2–10;
- vídeo inválido;
- objeto órfão/duplicado;
- usuário sem role de escrita;
- download cross-tenant;
- cleanup não apaga asset referenciado.

## Referências

- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Buckets privados e signed URLs](https://supabase.com/docs/guides/storage/buckets/fundamentals)

