from typing import Union, Optional

from posthog.hogql import ast
from posthog.hogql.context import HogQLContext
from posthog.hogql.modifiers import create_default_modifiers_for_team
from posthog.hogql.parser import parse_select, parse_expr
from posthog.hogql.printer import prepare_ast_for_printing
from posthog.hogql.visitor import clone_expr, CloningVisitor
from posthog.schema import OptimizeJoinedFilters, PersonsOnEventsMode, PersonsArgMaxVersion
from posthog.test.base import ClickhouseTestMixin, APIBaseTest


def f(s: Union[str, ast.Expr, None], placeholders: Optional[dict[str, ast.Expr]] = None) -> Union[ast.Expr, None]:
    if s is None:
        return None
    if isinstance(s, str):
        expr = parse_expr(s, placeholders=placeholders)
    else:
        expr = s
    return clone_expr(expr, clear_types=True, clear_locations=True)


def parse(
    s: str,
    placeholders: Optional[dict[str, ast.Expr]] = None,
) -> ast.SelectQuery | ast.SelectUnionQuery:
    parsed = parse_select(s, placeholders=placeholders)
    return parsed


class RemoveHiddenAliases(CloningVisitor):
    def visit_alias(self, node):
        if node.hidden:
            return self.visit(node.expr)
        return super().visit_alias(node)


class TestPersonWhereClauseExtractor(ClickhouseTestMixin, APIBaseTest):
    def get_clause(self, query: str):
        team = self.team
        modifiers = create_default_modifiers_for_team(team)
        modifiers.optimizeJoinedFilters = OptimizeJoinedFilters.true
        modifiers.personsOnEventsMode = PersonsOnEventsMode.disabled
        modifiers.personsArgMaxVersion = PersonsArgMaxVersion.v1
        context = HogQLContext(
            team_id=team.pk,
            team=team,
            enable_select_queries=True,
            modifiers=modifiers,
        )
        select = parse(query)
        new_select = prepare_ast_for_printing(select, context, "clickhouse")

        assert isinstance(new_select, ast.SelectQuery)
        assert isinstance(new_select.select_from, ast.JoinExpr)
        assert isinstance(new_select.select_from.next_join, ast.JoinExpr)
        assert isinstance(new_select.select_from.next_join.next_join, ast.JoinExpr)
        assert isinstance(new_select.select_from.next_join.next_join.table, ast.SelectQuery)

        assert new_select.select_from.next_join.alias == "events__pdi"
        assert new_select.select_from.next_join.next_join.alias == "events__pdi__person"

        where = new_select.select_from.next_join.next_join.table.where
        if where is None:
            return None

        where = RemoveHiddenAliases().visit(where)
        assert isinstance(where, ast.Expr)
        return clone_expr(where, clear_types=True, clear_locations=True)

    def test_person_properties(self):
        actual = self.get_clause("SELECT * FROM events WHERE person.properties.email = 'jimmy@posthog.com'")
        expected = f("properties.email = 'jimmy@posthog.com'")
        assert actual == expected

    def test_person_properties_andor_1(self):
        actual = self.get_clause("SELECT * FROM events WHERE person.properties.email = 'jimmy@posthog.com' or false")
        expected = f("properties.email = 'jimmy@posthog.com'")
        assert actual == expected

    def test_person_properties_andor_2(self):
        actual = self.get_clause("SELECT * FROM events WHERE person.properties.email = 'jimmy@posthog.com' and false")
        assert actual is None

    def test_person_properties_andor_3(self):
        actual = self.get_clause(
            "SELECT * FROM events WHERE person.properties.email = 'jimmy@posthog.com' and person.properties.email = 'timmy@posthog.com'"
        )
        expected = f("properties.email = 'jimmy@posthog.com' and properties.email = 'timmy@posthog.com'")
        assert actual == expected

    def test_person_properties_andor_4(self):
        actual = self.get_clause(
            "SELECT * FROM events WHERE person.properties.email = 'jimmy@posthog.com' or person.properties.email = 'timmy@posthog.com'"
        )
        expected = f("properties.email = 'jimmy@posthog.com' or properties.email = 'timmy@posthog.com'")
        assert actual == expected

    def test_person_properties_andor_5(self):
        actual = self.get_clause(
            "SELECT * FROM events WHERE person.properties.email = 'jimmy@posthog.com' or (1 and person.properties.email = 'timmy@posthog.com')"
        )
        expected = f("properties.email = 'jimmy@posthog.com' or properties.email = 'timmy@posthog.com'")
        assert actual == expected

    def test_person_properties_andor_6(self):
        actual = self.get_clause(
            "SELECT * FROM events WHERE person.properties.email = 'jimmy@posthog.com' or (0 or person.properties.email = 'timmy@posthog.com')"
        )
        expected = f("properties.email = 'jimmy@posthog.com' or properties.email = 'timmy@posthog.com'")
        assert actual == expected

    def test_person_properties_andor_7(self):
        actual = self.get_clause(
            "SELECT * FROM events WHERE person.properties.email = 'jimmy@posthog.com' or (1 or person.properties.email = 'timmy@posthog.com')"
        )
        assert actual is None

    def test_person_properties_andor_8(self):
        actual = self.get_clause(
            "SELECT * FROM events WHERE event == '$pageview' and person.properties.email = 'jimmy@posthog.com'"
        )
        expected = f("properties.email = 'jimmy@posthog.com'")
        assert actual == expected

    def test_person_properties_andor_9(self):
        actual = self.get_clause(
            "SELECT * FROM events WHERE event == '$pageview' or person.properties.email = 'jimmy@posthog.com'"
        )
        assert actual is None

    def test_person_properties_andor_10(self):
        actual = self.get_clause(
            "SELECT * FROM events WHERE properties.email = 'bla@posthog.com' or person.properties.email = 'jimmy@posthog.com'"
        )
        assert actual is None

    def test_person_properties_andor_11(self):
        actual = self.get_clause(
            "SELECT * FROM events WHERE properties.email = 'bla@posthog.com' and person.properties.email = 'jimmy@posthog.com'"
        )
        expected = f("properties.email = 'jimmy@posthog.com'")
        assert actual == expected
