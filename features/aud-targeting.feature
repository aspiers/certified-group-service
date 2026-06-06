Feature: Group targeting — legacy aud vs explicit repo (#27)
  The group a request targets can be named two ways. The NEW, correct form sets
  the JWT `aud` to the SERVICE DID and names the group with an explicit `repo`
  (querystring for queries, request body for procedures). The LEGACY form
  overloads `aud` as the group DID and sends no `repo`; it still works during the
  deprecation window but the response carries an RFC 8594 `Deprecation` header.

  Both forms are exercised here against a query (member.list) and a procedure
  (createRecord), proving backwards compatibility and the new path together.

  Background:
    Given the CGS environment is running
    And the test accounts are resolved

  # --- Query method: member.list ---

  Scenario: New path — member.list with aud=serviceDid and an explicit repo
    When the owner lists the group members with aud=service and an explicit repo
    Then the response status is 200
    And the response has no deprecation header

  Scenario: Legacy path — member.list with the aud=group overload
    When the owner lists the group members with the legacy aud overload
    Then the response status is 200
    And the response has a deprecation header

  # --- Procedure: createRecord ---

  Scenario: New path — createRecord with aud=serviceDid and repo in the body
    When the owner creates a feed post with aud=service and repo in the body
    Then the response status is 200
    And the response contains a record URI
    And the response has no deprecation header

  Scenario: Legacy path — createRecord with the aud=group overload
    When the owner creates a feed post with the legacy aud overload
    Then the response status is 200
    And the response contains a record URI
    And the response has a deprecation header
