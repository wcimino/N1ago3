import { Route, Switch, Redirect } from "wouter";
import { AIPage } from "./features/ai";
import { SettingsPage, ReprocessingPage, AutoClosePage, ProductCatalogPage, DuplicatesPage, ArchivePage, ZendeskUsersPage, ZendeskUserDetailPage } from "./features/settings";
import { EventsLayout } from "./features/events";
import { AtendimentosPage, UserConversationsPage } from "./features/conversations";
import { CadastroPage, UserStandardDetailPage, OrganizationStandardDetailPage } from "./features/cadastro";
import { ExportPage } from "./features/export";
import { ReportsPage, QuestionTopicsPage } from "./features/reports";
import { RoutingRulesPage } from "./features/routing";
import { HomePage } from "./shared/pages";

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/ai" component={AIPage} />
      <Route path="/ai/settings/:rest*" component={AIPage} />
      <Route path="/settings/events" component={EventsLayout} />
      <Route path="/settings/events/:rest*" component={EventsLayout} />
      <Route path="/atendimentos" component={AtendimentosPage} />
      <Route path="/atendimentos/routing" component={AtendimentosPage} />
      <Route path="/atendimentos/favoritos" component={AtendimentosPage} />
      <Route path="/atendimentos/:userId/:conversationId">{(params) => <UserConversationsPage params={params} />}</Route>
      <Route path="/atendimentos/:userId">{(params) => <UserConversationsPage params={params} />}</Route>
      <Route path="/settings/maintenance/export" component={ExportPage} />
      <Route path="/settings/maintenance/export/:rest*" component={ExportPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/reports/question-topics" component={QuestionTopicsPage} />
      <Route path="/routing-rules" component={RoutingRulesPage} />
      <Route path="/settings">{() => <Redirect to="/settings/access" />}</Route>
      <Route path="/settings/access">{() => <SettingsPage activeTab="access" />}</Route>
      <Route path="/settings/general">{() => <SettingsPage activeTab="general" />}</Route>
      <Route path="/settings/catalog">{() => <SettingsPage activeTab="catalog" />}</Route>
      <Route path="/settings/maintenance">{() => <SettingsPage activeTab="maintenance" />}</Route>
      <Route path="/settings/external-data">{() => <SettingsPage activeTab="external-data" />}</Route>
      <Route path="/settings/external-events">{() => <SettingsPage activeTab="external-events" />}</Route>
      <Route path="/settings/monitoring">{() => <SettingsPage activeTab="monitoring" />}</Route>
      <Route path="/settings/external-data/zendesk-users" component={ZendeskUsersPage} />
      <Route path="/settings/external-data/zendesk-users/:id">{(params) => <ZendeskUserDetailPage params={params} />}</Route>
      <Route path="/settings/reprocessing" component={ReprocessingPage} />
      <Route path="/settings/auto-close" component={AutoClosePage} />
      <Route path="/settings/catalog/users">{() => <CadastroPage activeTab="usuarios" />}</Route>
      <Route path="/settings/catalog/users/:email">{(params) => <UserStandardDetailPage params={params} />}</Route>
      <Route path="/settings/catalog/organizations">{() => <CadastroPage activeTab="organizacoes" />}</Route>
      <Route path="/settings/catalog/organizations/:cnpjRoot">{(params) => <OrganizationStandardDetailPage params={params} />}</Route>
      <Route path="/settings/catalog/products" component={ProductCatalogPage} />
      <Route path="/settings/maintenance/duplicates" component={DuplicatesPage} />
      <Route path="/settings/maintenance/archive" component={ArchivePage} />
    </Switch>
  );
}
