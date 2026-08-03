import { Link } from "react-router-dom";
import { BrandMark, Card } from "../ui";

const SUPPORT_EMAIL = "suporte@lumipost.ai";
const UPDATED_AT = "3 de agosto de 2026";

function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell flex min-h-screen justify-center p-4 py-12">
      <Card className="w-full max-w-3xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <BrandMark />
          <Link to="/" className="text-muted text-sm underline">
            Voltar ao Lumipost
          </Link>
        </div>
        <p className="eyebrow">Lumipost.ai</p>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <p className="text-muted mt-1 text-sm">
          Última atualização: {UPDATED_AT}
        </p>
        <div className="prose prose-sm mt-6 max-w-none space-y-4 text-sm leading-relaxed">
          {children}
        </div>
      </Card>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalShell title="Política de Privacidade">
      <p>
        Esta política descreve como o Lumipost.ai ("Lumipost", "nós") coleta,
        usa, armazena e protege os dados de quem utiliza a plataforma de
        agendamento e geração de conteúdo para redes sociais.
      </p>

      <h2 className="text-base font-semibold">1. Dados que coletamos</h2>
      <ul className="list-disc pl-5">
        <li>
          Dados de cadastro: nome, e-mail e senha (armazenada de forma
          criptografada pelo Supabase Auth).
        </li>
        <li>
          Dados de identidade de marca: nome da empresa, tom de voz e
          preferências de conteúdo informadas pelo usuário.
        </li>
        <li>
          Dados de contas de redes sociais conectadas (Instagram/Facebook):
          identificador da conta profissional, nome de exibição, foto e
          métricas públicas do perfil, obtidos somente após autorização
          explícita via login OAuth da Meta.
        </li>
        <li>
          Conteúdo criado ou enviado pelo usuário: textos, imagens, vídeos e
          agendamentos.
        </li>
        <li>
          Dados de cobrança: processados diretamente pelo Stripe. O Lumipost
          não armazena número de cartão de crédito.
        </li>
      </ul>

      <h2 className="text-base font-semibold">2. Como usamos os dados</h2>
      <p>
        Usamos os dados para operar a plataforma: gerar e agendar conteúdo,
        publicar nas contas conectadas pelo próprio usuário, calcular saldo de
        créditos, processar pagamentos e dar suporte. Nenhum dado é vendido a
        terceiros.
      </p>

      <h2 className="text-base font-semibold">
        3. Tokens de acesso de redes sociais
      </h2>
      <p>
        Os tokens de acesso obtidos via login da Meta (Facebook/Instagram) são
        armazenados de forma criptografada em cofre seguro (Supabase Vault) e
        usados exclusivamente por processos internos do servidor para
        publicar o conteúdo agendado pelo próprio usuário. O token nunca é
        exposto ao navegador nem a terceiros.
      </p>

      <h2 className="text-base font-semibold">4. Compartilhamento com terceiros</h2>
      <p>
        Utilizamos provedores de infraestrutura para operar o serviço:
        Supabase (banco de dados, autenticação e armazenamento), Stripe
        (pagamentos), Meta Platforms (publicação em Instagram/Facebook) e um
        provedor de modelos de IA para geração de conteúdo sob demanda do
        usuário. Cada provedor recebe apenas os dados estritamente
        necessários para executar sua função.
      </p>

      <h2 className="text-base font-semibold">5. Segurança</h2>
      <p>
        Aplicamos isolamento de dados por organização (Row Level Security),
        conexões criptografadas (HTTPS/TLS), armazenamento privado de mídia e
        controles de acesso baseados em função. Nenhum sistema é
        absolutamente livre de falhas; trabalhamos continuamente para reduzir
        riscos.
      </p>

      <h2 className="text-base font-semibold">6. Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção, portabilidade ou exclusão dos
        seus dados a qualquer momento. Veja as instruções em{" "}
        <Link to="/exclusao-de-dados" className="underline">
          Exclusão de Dados do Usuário
        </Link>{" "}
        ou escreva para{" "}
        <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>

      <h2 className="text-base font-semibold">7. Contato</h2>
      <p>
        Dúvidas sobre esta política podem ser enviadas para{" "}
        <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </LegalShell>
  );
}

export function DataDeletionPage() {
  return (
    <LegalShell title="Exclusão de Dados do Usuário">
      <p>
        Você tem controle total sobre os seus dados no Lumipost.ai e pode
        solicitar a exclusão completa da sua conta e do conteúdo associado a
        qualquer momento.
      </p>

      <h2 className="text-base font-semibold">Como solicitar a exclusão</h2>
      <ol className="list-decimal pl-5">
        <li>
          Envie um e-mail para{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}?subject=Exclus%C3%A3o%20de%20dados`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          a partir do endereço cadastrado na sua conta, com o assunto
          "Exclusão de dados".
        </li>
        <li>
          Confirmamos a identidade do solicitante e processamos a exclusão em
          até 30 dias.
        </li>
        <li>
          Removemos permanentemente: dados de perfil, identidade de marca,
          conteúdos, agendamentos, métricas e tokens de acesso de redes
          sociais conectadas. Registros financeiros podem ser retidos pelo
          prazo mínimo exigido por lei fiscal/contábil antes da exclusão
          definitiva.
        </li>
      </ol>

      <h2 className="text-base font-semibold">
        Desconexão do Instagram/Facebook
      </h2>
      <p>
        Se você apenas deseja revogar o acesso do Lumipost à sua conta do
        Instagram ou Facebook, sem excluir a conta inteira do Lumipost, você
        pode fazer isso a qualquer momento em{" "}
        <strong>Configurações → Contas conectadas</strong> dentro do
        aplicativo, ou diretamente nas configurações de aplicativos conectados
        da sua conta Meta. A revogação encerra o acesso e o token armazenado é
        apagado do nosso cofre.
      </p>
    </LegalShell>
  );
}
