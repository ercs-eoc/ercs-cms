import {
    useCallback,
    useEffect,
    useMemo,
} from 'react';
import {
    createSearchParams,
    useNavigate,
    useParams,
    useSearchParams,
} from 'react-router';
import {
    BlockLoading,
    Button,
    Container,
    InputSection,
    ListView,
    RadioInput,
    TextArea,
    TextInput,
} from '@ifrc-go/ui';
import {
    isDefined,
    isNotDefined,
} from '@togglecorp/fujs';
import {
    createSubmitHandler,
    getErrorObject,
    type ObjectSchema,
    type PartialForm,
    removeNull,
    requiredStringCondition,
    useForm,
} from '@togglecorp/toggle-form';

import {
    type LinkCreateInput,
    LinkTypeEnum,
    type LinkUpdateInput,
    useCreateLinkMutation,
    useLinkDetailQuery,
    useUpdateLinkMutation,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useGlobalEnums from '#hooks/useGlobalEnums';
import routes from '#root/config/routes';
import {
    errorMessage,
    keySelector,
    labelSelector,
    transformToFormError,
} from '#utils/common';

type PartialFormType = PartialForm<LinkCreateInput>;
type FormSchema = ObjectSchema<PartialFormType>;
type FormSchemaFields = ReturnType<FormSchema['fields']>;

const LinkSchema: FormSchema = {
    fields: (): FormSchemaFields => ({
        title: {
            required: true,
            requiredValidation: requiredStringCondition,
        },
        url: {
            required: true,
            requiredValidation: requiredStringCondition,
        },
        linkType: {
            required: true,
        },
        description: {},
    }),
};

function isAllowedLinkType(value: string | null | undefined): value is LinkTypeEnum {
    return value === LinkTypeEnum.Internal || value === LinkTypeEnum.External;
}

function LinkForm() {
    const { id } = useParams();
    const alert = useAlert();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const seedType = searchParams.get('type');
    const initialValue = useMemo<PartialFormType>(() => ({
        linkType: isAllowedLinkType(seedType) ? seedType : undefined,
    }), [seedType]);

    const [{ data, fetching: linkDetailFetch }] = useLinkDetailQuery({
        variables: { id: isDefined(id) ? id : '' },
        pause: isNotDefined(id),
    });

    const [{ fetching: createPending }, createLinkMutate] = useCreateLinkMutation();
    const [{ fetching: updatePending }, updateLinkMutate] = useUpdateLinkMutation();

    const pending = createPending || updatePending || linkDetailFetch;

    const {
        setFieldValue,
        error: formError,
        value,
        validate,
        setError,
        setValue,
    } = useForm(LinkSchema, { value: initialValue });

    const {
        linkType: linkTypeOptions,
    } = useGlobalEnums();

    const error = getErrorObject(formError);

    const navigateToLinks = useCallback((linkType?: LinkTypeEnum | null) => {
        navigate({
            pathname: routes.links.path,
            search: isDefined(linkType)
                ? createSearchParams({ tab: linkType }).toString()
                : undefined,
        });
    }, [navigate]);

    const handleCreate = useCallback(async (mutationData: PartialFormType) => {
        const createPayload = removeNull(mutationData) as unknown as LinkCreateInput;
        const res = await createLinkMutate({ data: createPayload });
        const result = res.data?.createLink;

        if (isDefined(result) && result.ok) {
            navigateToLinks(mutationData.linkType);
            alert.show('Link created successfully', { variant: 'success' });
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [createLinkMutate, navigateToLinks, alert, setError]);

    const handleUpdate = useCallback(async (mutationData: PartialFormType) => {
        if (isNotDefined(id)) {
            return;
        }
        const updatePayload = {
            ...removeNull(mutationData),
            description: mutationData.description ?? null,
        } as LinkUpdateInput;

        const res = await updateLinkMutate({ id, data: updatePayload });
        const result = res.data?.updateLink;

        if (isDefined(result) && result.ok) {
            navigateToLinks(mutationData.linkType);
            alert.show('Link updated successfully', { variant: 'success' });
        } else if (isDefined(result) && isDefined(result.errors)) {
            setError(transformToFormError(result.errors));
            alert.show(errorMessage, { variant: 'danger' });
        } else {
            alert.show(errorMessage, { variant: 'danger' });
        }
    }, [updateLinkMutate, id, navigateToLinks, alert, setError]);

    const handleFormSubmit = useCallback(
        () => createSubmitHandler(
            validate,
            setError,
            isDefined(id) ? handleUpdate : handleCreate,
        )(),
        [validate, setError, id, handleUpdate, handleCreate],
    );

    const handleCancelClick = useCallback(() => {
        navigateToLinks(value.linkType);
    }, [navigateToLinks, value.linkType]);

    useEffect(() => {
        if (isNotDefined(data?.link)) {
            return;
        }
        const linkValue = removeNull(data.link);
        setValue(linkValue);
    }, [data, setValue]);

    if (linkDetailFetch || createPending || updatePending) {
        return (
            <BlockLoading
                withoutBorder
                compact
                message="Loading"
            />
        );
    }

    return (
        <Container
            heading={id ? 'Edit Link' : 'Create New Link'}
            headerDescription={id
                ? 'Manage and update links to add on public facing resources'
                : 'Create a new internal or external link to add on public facing resources'}
            withPadding
            footerActions={(
                <ListView>
                    <Button
                        name={undefined}
                        onClick={handleCancelClick}
                    >
                        Cancel
                    </Button>
                    <Button
                        name={undefined}
                        onClick={handleFormSubmit}
                        styleVariant="filled"
                        disabled={pending}
                    >
                        Save
                    </Button>
                </ListView>
            )}
        >
            <ListView layout="block">
                <InputSection
                    title="Title"
                    description="Enter the title of the link"
                    withAsteriskOnTitle
                >
                    <TextInput
                        name="title"
                        value={value.title}
                        onChange={setFieldValue}
                        error={error?.title}
                    />
                </InputSection>
                <InputSection
                    title="Description"
                    description="Enter the description of the link"
                >
                    <TextArea
                        name="description"
                        value={value.description}
                        onChange={setFieldValue}
                        error={error?.description}
                    />
                </InputSection>
                <InputSection
                    title="Link"
                    description="Enter the link for the title"
                >
                    <TextInput
                        name="url"
                        value={value.url}
                        onChange={setFieldValue}
                        error={error?.url}
                    />
                </InputSection>
                <InputSection
                    title="Link Type"
                    description="Choose the Link type is internal or external"
                >
                    <RadioInput
                        name="linkType"
                        value={value.linkType}
                        options={linkTypeOptions}
                        labelSelector={labelSelector}
                        keySelector={keySelector}
                        onChange={setFieldValue}
                        error={error?.linkType}
                    />
                </InputSection>
            </ListView>
        </Container>
    );
}

export default LinkForm;
