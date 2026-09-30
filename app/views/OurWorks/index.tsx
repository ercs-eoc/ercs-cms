import {
    useCallback,
    useMemo,
} from 'react';
import { AddFillIcon } from '@ifrc-go/icons';
import {
    Button,
    Container,
    Pager,
    Table,
} from '@ifrc-go/ui';
import {
    createElementColumn,
    createStringColumn,
} from '@ifrc-go/ui/utils';
import { isDefined } from '@togglecorp/fujs';

import EditDeleteActions, { type Props as EditDeleteActionsProps } from '#components/EditDeleteActions';
import StatusCell from '#components/StatusCell';
import {
    AdminAreaLevel,
    DashboardPage,
    type ExternalDashboardFilter,
    type ExternalDashboardsQuery,
    Ordering,
    useDeleteExternalDashboardMutation,
    useExternalDashboardsQuery,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useDashboardReorder from '#hooks/useDashboardReorder';
import useFilterState from '#hooks/useFilterState';
import useRegionMap from '#hooks/useRegionMap';
import useRouting from '#hooks/useRouting';
import {
    errorMessage,
    getErrorMessage,
    idSelector,
} from '#utils/common';
import createDragHandleColumn from '#utils/table';

import WorksFilter from './WorksFilter';

type WorksListItem = NonNullable<NonNullable<ExternalDashboardsQuery['externalDashboards']>['results'][number]> & { no: string };

export interface WorksFilterType extends Omit<ExternalDashboardFilter, 'isActive'> {
    isActive: string | undefined;
}

const defaultFilter: WorksFilterType = {
    isActive: undefined,
    page: undefined,
    search: undefined,
    regions: undefined,
};

function OurWorks() {
    const {
        filter,
        rawFilter,
        filtered,
        setFilterField,
        resetFilter,
        page,
        setPage,
        limit,
        offset,
    } = useFilterState({
        filter: defaultFilter,
    });

    const alert = useAlert();
    const navigate = useRouting();

    const regionMap = useRegionMap(AdminAreaLevel.Region);

    const queryVariables = useMemo(() => ({
        pagination: {
            limit,
            offset,
        },
        filters: {
            isActive: isDefined(filter.isActive) ? filter.isActive === 'true' : undefined,
            search: filter.search || undefined,
            regions: filter.regions?.length ? filter.regions : undefined,
            AND: {
                page: DashboardPage.EmergencyResponse,
                OR: {
                    page: DashboardPage.ProjectMapping,
                },
            },
            page: filter.page ?? null,
        },
        ordering: [{ order: Ordering.Asc }, { title: Ordering.Asc }],
    }), [limit, offset, filter]);

    const [{ fetching, data }, reExecuteQuery] = useExternalDashboardsQuery({
        variables: queryVariables,
    });
    const [, deleteExternalDashboard] = useDeleteExternalDashboardMutation();

    const serverData = useMemo(() => (
        (data?.externalDashboards?.results ?? []).map((dashboard, index) => {
            const no = (page - 1) * limit + index + 1;
            return {
                ...dashboard,
                no: String(no),
            };
        }) as unknown as WorksListItem[]), [page, data, limit]);

    const handleReorderSuccess = useCallback(() => {
        reExecuteQuery({ requestPolicy: 'network-only' });
    }, [reExecuteQuery]);

    const { tableData, rowModifier } = useDashboardReorder(
        serverData,
        page,
        limit,
        handleReorderSuccess,
    );

    const handleDeleteClick = useCallback(
        (id: string) => {
            deleteExternalDashboard({ id }).then((resp) => {
                const result = resp.data?.deleteExternalDashboard;
                if (result?.ok) {
                    if (tableData.length === 1 && page > 1) {
                        setPage(page - 1);
                    } else {
                        reExecuteQuery({ requestPolicy: 'network-only' });
                    }
                    alert.show('Dashboard deleted successfully', { variant: 'success' });
                } else {
                    alert.show(getErrorMessage(resp.error, result?.errors), { variant: 'danger' });
                }
            }).catch(() => {
                alert.show(errorMessage, { variant: 'danger' });
            });
        },
        [deleteExternalDashboard, reExecuteQuery, alert, tableData.length, page, setPage],
    );

    const columns = useMemo(() => [
        createDragHandleColumn<WorksListItem>(),
        createStringColumn<WorksListItem, string | number>(
            'no',
            'No.',
            (item) => item.no,
        ),
        createStringColumn<WorksListItem, string | number>(
            'title',
            'Title',
            (item) => item.title,
        ),
        createStringColumn<WorksListItem, string | number>(
            'operation',
            'Operation',
            (item) => item.pageDisplay,
        ),
        createStringColumn<WorksListItem, string | number>(
            'region',
            'Region',
            (item) => (isDefined(item.regionId) ? regionMap[item.regionId] : '-'),
        ),
        createElementColumn<WorksListItem, string | number, { isActive: boolean }>(
            'status',
            'Status',
            StatusCell,
            (_, datum) => ({
                isActive: datum.isActive,
            }),
        ),
        createElementColumn<WorksListItem, string | number, EditDeleteActionsProps>(
            'actions',
            '',
            EditDeleteActions,
            (_, datum) => ({
                id: datum.id,
                onDelete: handleDeleteClick,
                itemTitle: datum.title,
                to: 'editWorks',
            }),
            { columnWidth: 150 },
        ),
    ], [handleDeleteClick, regionMap]);

    const handleCreateClick = useCallback(() => {
        navigate('createWorks');
    }, [navigate]);

    return (
        <Container
            withPadding
            heading="Our Work"
            filters={(
                <WorksFilter
                    value={rawFilter}
                    onChange={setFilterField}
                    filtered={filtered}
                    onReset={resetFilter}
                />
            )}
            headerDescription="Track, organize, and update all ongoing work and initiatives"
            headerActions={(
                <Button
                    name={undefined}
                    onClick={handleCreateClick}
                    before={(<AddFillIcon />)}
                    styleVariant="filled"
                >
                    Create
                </Button>
            )}
            footerActions={(
                <Pager
                    activePage={page}
                    itemsCount={data?.externalDashboards?.totalCount ?? 0}
                    maxItemsPerPage={limit}
                    onActivePageChange={setPage}
                />
            )}
        >
            <Table
                keySelector={idSelector}
                columns={columns}
                data={tableData}
                filtered={filtered}
                pending={fetching}
                rowModifier={rowModifier}
            />
        </Container>
    );
}

export default OurWorks;
